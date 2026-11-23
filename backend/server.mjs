import { randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";

const port = Number(process.env.PORT || 8000);
const adminUsername = process.env.ADMIN_USERNAME;
const adminPassword = process.env.ADMIN_PASSWORD;
const frontendOrigin = process.env.FRONTEND_ORIGIN || "http://localhost:5173";
const dataFile = resolve(
  process.env.DATA_FILE || fileURLToPath(new URL("./data.json", import.meta.url)),
);
const tokenLifetimeMs = 8 * 60 * 60 * 1000;
const sessions = new Map();
const allowedOrigins = new Set([
  frontendOrigin,
  ...(process.env.FRONTEND_ORIGIN ? [] : ["http://127.0.0.1:5173"]),
]);

if (!adminUsername || !adminPassword) {
  throw new Error("Set ADMIN_USERNAME and ADMIN_PASSWORD before starting the API.");
}
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("PORT must be a valid TCP port.");
}

class ApiError extends Error {
  constructor(status, detail) {
    super(detail);
    this.status = status;
  }
}

function matchesSecret(actual, expected) {
  const actualBytes = Buffer.from(actual);
  const expectedBytes = Buffer.from(expected);
  return (
    actualBytes.length === expectedBytes.length &&
    timingSafeEqual(actualBytes, expectedBytes)
  );
}

function sampleData() {
  const now = new Date();
  const hoursAgo = (hours) =>
    new Date(now.getTime() - hours * 60 * 60 * 1000).toISOString();

  return {
    orders: [
      {
        _id: "order_1001",
        user_id: "customer_201",
        waiter_id: null,
        recipient: "Jordan Lee",
        status: "PENDING",
        paymentStatus: "PAID",
        waiter_settlement_status: "UNSETTLED",
        items: [
          { id: "item_1", name: "Classic Burger", quantity: 2, price: 12.5 },
          { id: "item_2", name: "Fries", quantity: 1, price: 4 },
        ],
        totalAmount: 29,
        createdAt: hoursAgo(1),
        updatedAt: hoursAgo(1),
      },
      {
        _id: "order_1002",
        user_id: "customer_202",
        waiter_id: 102,
        recipient: "Sam Rivera",
        status: "PREPARING",
        paymentStatus: "PENDING",
        waiter_settlement_status: "PENDING",
        items: [
          { id: "item_3", name: "Margherita Pizza", quantity: 1, price: 18 },
        ],
        totalAmount: 18,
        createdAt: hoursAgo(3),
        updatedAt: hoursAgo(2),
      },
    ],
    waiters: [
      {
        _id: "waiter_102",
        first_name: "Taylor",
        last_name: "Morgan",
        email: "taylor@example.com",
        phone_number: "+1-555-0102",
        telegram_id: 102,
        is_active: true,
      },
    ],
    waiterRequests: [
      {
        _id: "request_301",
        first_name: "Avery",
        last_name: "Chen",
        email: "avery@example.com",
        phone_number: "+1-555-0301",
        telegram_id: 301,
        submittedAt: hoursAgo(2),
        status: "PENDING",
      },
    ],
  };
}

function addOrderEvent(
  store,
  order,
  type,
  message,
  actorName,
  actorRole,
  createdAt = new Date().toISOString(),
  changes,
) {
  const event = {
    _id: randomUUID(),
    order_id: order._id,
    type,
    message,
    actor_name: actorName,
    actor_role: actorRole,
    createdAt,
    ...(changes ? { changes } : {}),
  };
  store.orderEvents.push(event);
  return event;
}

function ensureOrderEvents(store) {
  let changed = false;
  if (!Array.isArray(store.orderEvents)) {
    store.orderEvents = [];
    changed = true;
  }

  for (const order of store.orders) {
    const hasCreationEvent = store.orderEvents.some(
      (event) => event.order_id === order._id && event.type === "ORDER_CREATED",
    );
    if (!hasCreationEvent) {
      addOrderEvent(
        store,
        order,
        "ORDER_CREATED",
        "Order received",
        order.recipient || "Customer",
        "CUSTOMER",
        order.createdAt || new Date().toISOString(),
      );
      changed = true;
    }
  }
  return changed;
}

async function loadData() {
  try {
    const data = JSON.parse(await readFile(dataFile, "utf8"));
    if (
      !Array.isArray(data.orders) ||
      !Array.isArray(data.waiters) ||
      !Array.isArray(data.waiterRequests)
    ) {
      throw new Error("Data file must contain orders, waiters, and waiterRequests arrays.");
    }
    if (ensureOrderEvents(data)) {
      await saveData(data);
    }
    return data;
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw new Error(`Could not load API data from ${dataFile}: ${error.message}`);
    }

    const initialData = sampleData();
    ensureOrderEvents(initialData);
    await saveData(initialData);
    return initialData;
  }
}

let data;
let writeQueue = Promise.resolve();

async function saveData(nextData) {
  await mkdir(dirname(dataFile), { recursive: true });
  const temporaryFile = `${dataFile}.${process.pid}.tmp`;
  await writeFile(temporaryFile, `${JSON.stringify(nextData, null, 2)}\n`, "utf8");
  await rename(temporaryFile, dataFile);
}

function updateData(update) {
  const operation = writeQueue.then(async () => {
    const result = update(data);
    await saveData(data);
    return result;
  });
  writeQueue = operation.then(
    () => undefined,
    () => undefined,
  );
  return operation;
}

function sendJson(response, status, payload) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload));
}

async function readBody(request) {
  let body = "";
  for await (const chunk of request) {
    body += chunk;
    if (Buffer.byteLength(body, "utf8") > 1024 * 1024) {
      throw new ApiError(413, "Request body exceeds the 1 MB limit.");
    }
  }
  if (!body) return {};

  const contentType = request.headers["content-type"] || "";
  if (contentType.includes("application/x-www-form-urlencoded")) {
    return Object.fromEntries(new URLSearchParams(body));
  }
  if (contentType.includes("application/json")) {
    try {
      const parsed = JSON.parse(body);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed;
      }
    } catch {
      throw new ApiError(400, "Request body must contain valid JSON.");
    }
  }
  throw new ApiError(415, "Use application/json or application/x-www-form-urlencoded.");
}

function requireAdmin(request) {
  const authorization = request.headers.authorization || "";
  const token = authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : "";
  const expiresAt = sessions.get(token);
  if (!expiresAt || expiresAt <= Date.now()) {
    sessions.delete(token);
    throw new ApiError(401, "A valid admin access token is required.");
  }
}

function filterOrders(orders, params) {
  const status = params.get("status");
  const recipient = params.get("recipient")?.toLowerCase();
  return orders.filter((order) => {
    if (params.has("_id") && order._id !== params.get("_id")) return false;
    if (params.has("user_id") && order.user_id !== params.get("user_id")) return false;
    if (
      params.has("waiter_id") &&
      String(order.waiter_id) !== params.get("waiter_id")
    ) {
      return false;
    }
    if (recipient && !order.recipient.toLowerCase().includes(recipient)) return false;
    if (status && order.status !== status) return false;
    if (
      params.has("paymentStatus") &&
      order.paymentStatus !== params.get("paymentStatus")
    ) {
      return false;
    }
    if (
      params.has("waiter_settlement_status") &&
      order.waiter_settlement_status !== params.get("waiter_settlement_status")
    ) {
      return false;
    }
    if (
      params.get("include_unassigned") !== "true" &&
      params.has("waiter_id") &&
      order.waiter_id === null
    ) {
      return false;
    }
    return true;
  });
}

const orderStatuses = new Set([
  "PENDING",
  "ACCEPTED",
  "PREPARING",
  "READY",
  "DELIVERED",
  "CANCELLED",
]);
const paymentStatuses = new Set(["PENDING", "PAID", "FAILED", "REFUNDED"]);
const settlementStatuses = new Set(["UNSETTLED", "SETTLED", "PENDING"]);

function validateOrderItems(items) {
  if (!Array.isArray(items)) {
    throw new ApiError(400, "items must be an array.");
  }
  return items.map((item) => {
    if (
      !item ||
      typeof item.name !== "string" ||
      !item.name.trim() ||
      !Number.isSafeInteger(item.quantity) ||
      item.quantity < 1 ||
      typeof item.price !== "number" ||
      !Number.isFinite(item.price) ||
      item.price < 0
    ) {
      throw new ApiError(400, "Each item needs a name, positive quantity, and non-negative price.");
    }
    return {
      id: typeof item.id === "string" && item.id ? item.id : randomUUID(),
      name: item.name.trim(),
      quantity: item.quantity,
      price: item.price,
    };
  });
}

function validateOrderPatch(body) {
  const allowedFields = new Set([
    "status",
    "paymentStatus",
    "waiter_settlement_status",
    "waiter_id",
    "recipient",
    "items",
    "totalAmount",
  ]);
  const unsupportedField = Object.keys(body).find((field) => !allowedFields.has(field));
  if (unsupportedField) {
    throw new ApiError(400, `Unsupported order field: ${unsupportedField}.`);
  }
  if (!Object.keys(body).length) {
    throw new ApiError(400, "Provide at least one order field to update.");
  }

  const updates = { ...body };
  if (updates.status !== undefined) {
    if (typeof updates.status !== "string") {
      throw new ApiError(400, "status must be a string.");
    }
    updates.status = updates.status.toUpperCase();
    if (!orderStatuses.has(updates.status)) {
      throw new ApiError(400, "Unsupported order status.");
    }
  }
  if (updates.paymentStatus !== undefined) {
    if (typeof updates.paymentStatus !== "string") {
      throw new ApiError(400, "paymentStatus must be a string.");
    }
    updates.paymentStatus = updates.paymentStatus.toUpperCase();
    if (!paymentStatuses.has(updates.paymentStatus)) {
      throw new ApiError(400, "Unsupported payment status.");
    }
  }
  if (updates.waiter_settlement_status !== undefined) {
    if (typeof updates.waiter_settlement_status !== "string") {
      throw new ApiError(400, "waiter_settlement_status must be a string.");
    }
    updates.waiter_settlement_status = updates.waiter_settlement_status.toUpperCase();
    if (!settlementStatuses.has(updates.waiter_settlement_status)) {
      throw new ApiError(400, "Unsupported waiter settlement status.");
    }
  }
  if (updates.waiter_id !== undefined && updates.waiter_id !== null) {
    updates.waiter_id = Number(updates.waiter_id);
    if (!Number.isSafeInteger(updates.waiter_id) || updates.waiter_id < 1) {
      throw new ApiError(400, "waiter_id must be a positive whole number or null.");
    }
  }
  if (updates.recipient !== undefined) {
    if (typeof updates.recipient !== "string" || !updates.recipient.trim()) {
      throw new ApiError(400, "recipient must be a non-empty string.");
    }
    updates.recipient = updates.recipient.trim();
  }
  if (updates.items !== undefined) {
    updates.items = validateOrderItems(updates.items);
  }
  if (updates.totalAmount !== undefined) {
    if (
      typeof updates.totalAmount !== "number" ||
      !Number.isFinite(updates.totalAmount) ||
      updates.totalAmount < 0
    ) {
      throw new ApiError(400, "totalAmount must be a non-negative number.");
    }
  }
  return updates;
}

function waiterName(store, waiterId) {
  const waiter = store.waiters.find(
    (entry) =>
      Number(entry.telegram_id) === Number(waiterId) ||
      entry._id === String(waiterId),
  );
  return waiter
    ? `${waiter.first_name} ${waiter.last_name || ""}`.trim()
    : null;
}

function describeOrderValue(value) {
  if (value === null || value === undefined || value === "") return "None";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function validateWaiterUpdate(body) {
  const allowedFields = new Set([
    "first_name",
    "last_name",
    "email",
    "phone_number",
    "telegram_id",
    "account_number",
    "bank_name",
    "is_active",
  ]);
  const update = Object.fromEntries(
    Object.entries(body).filter(([key]) => allowedFields.has(key)),
  );
  if (!Object.keys(update).length) {
    throw new ApiError(400, "Provide at least one supported waiter field.");
  }
  if (update.email !== undefined && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(update.email)) {
    throw new ApiError(400, "Provide a valid email address.");
  }
  if (update.is_active !== undefined && typeof update.is_active !== "boolean") {
    throw new ApiError(400, "is_active must be a boolean.");
  }
  for (const field of ["first_name", "last_name", "phone_number", "bank_name"]) {
    if (update[field] !== undefined && typeof update[field] !== "string") {
      throw new ApiError(400, `${field} must be a string.`);
    }
  }
  for (const field of ["telegram_id", "account_number"]) {
    if (
      update[field] !== undefined &&
      update[field] !== null &&
      !Number.isSafeInteger(Number(update[field]))
    ) {
      throw new ApiError(400, `${field} must be a whole number.`);
    }
    if (update[field] !== undefined && update[field] !== null) {
      update[field] = Number(update[field]);
    }
  }
  return update;
}

async function handleRequest(request, response) {
  const origin = request.headers.origin;
  if (origin && !allowedOrigins.has(origin)) {
    throw new ApiError(403, "This frontend origin is not allowed.");
  }
  if (origin) {
    response.setHeader("Access-Control-Allow-Origin", origin);
    response.setHeader("Vary", "Origin");
  }
  response.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
  response.setHeader("X-Content-Type-Options", "nosniff");
  if (request.method === "OPTIONS") {
    response.writeHead(204);
    response.end();
    return;
  }

  const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);
  const pathname = url.pathname.replace(/\/+$/, "") || "/";

  if (request.method === "GET" && pathname === "/health") {
    sendJson(response, 200, { status: "ok" });
    return;
  }
  if (request.method === "POST" && pathname === "/admins/login") {
    const credentials = await readBody(request);
    if (
      typeof credentials.username !== "string" ||
      typeof credentials.password !== "string" ||
      !matchesSecret(credentials.username, adminUsername) ||
      !matchesSecret(credentials.password, adminPassword)
    ) {
      throw new ApiError(401, "Invalid username or password.");
    }
    const accessToken = randomBytes(32).toString("base64url");
    sessions.set(accessToken, Date.now() + tokenLifetimeMs);
    sendJson(response, 200, { access_token: accessToken, token_type: "bearer" });
    return;
  }

  if (request.method === "POST" && pathname === "/waiter/requests") {
    const application = await readBody(request);
    const firstName =
      typeof application.first_name === "string" ? application.first_name.trim() : "";
    const lastName =
      typeof application.last_name === "string" ? application.last_name.trim() : "";
    const email =
      typeof application.email === "string" ? application.email.trim().toLowerCase() : "";
    const phoneNumber =
      typeof application.phone_number === "string"
        ? application.phone_number.trim()
        : "";
    const telegramId = Number(application.telegram_id);
    if (!firstName) throw new ApiError(400, "first_name is required.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new ApiError(400, "Provide a valid email address.");
    }
    if (!Number.isSafeInteger(telegramId)) {
      throw new ApiError(400, "telegram_id must be a whole number.");
    }

    const newRequest = await updateData((store) => {
      const emailExists =
        store.waiters.some((waiter) => waiter.email.toLowerCase() === email) ||
        store.waiterRequests.some(
          (existing) =>
            existing.email.toLowerCase() === email && existing.status === "PENDING",
        );
      if (emailExists) {
        throw new ApiError(409, "A waiter account or pending application already uses this email.");
      }

      const created = {
        _id: randomUUID(),
        first_name: firstName,
        last_name: lastName,
        email,
        phone_number: phoneNumber,
        telegram_id: telegramId,
        submittedAt: new Date().toISOString(),
        status: "PENDING",
      };
      store.waiterRequests.push(created);
      return created;
    });
    sendJson(response, 201, newRequest);
    return;
  }
  requireAdmin(request);

  if (request.method === "POST" && pathname === "/order") {
    const body = await readBody(request);
    const recipient =
      typeof body.recipient === "string" ? body.recipient.trim() : "";
    if (!recipient) throw new ApiError(400, "recipient is required.");
    if (
      body.user_id !== undefined &&
      typeof body.user_id !== "string"
    ) {
      throw new ApiError(400, "user_id must be a string.");
    }

    const statusFields = {};
    for (const field of ["status", "paymentStatus", "waiter_settlement_status"]) {
      if (body[field] !== undefined) statusFields[field] = body[field];
    }
    const orderDefaults = Object.keys(statusFields).length
      ? validateOrderPatch(statusFields)
      : {};
    const items = validateOrderItems(body.items || []);
    const totalAmount =
      body.totalAmount === undefined
        ? items.reduce((sum, item) => sum + item.quantity * item.price, 0)
        : body.totalAmount;
    if (
      typeof totalAmount !== "number" ||
      !Number.isFinite(totalAmount) ||
      totalAmount < 0
    ) {
      throw new ApiError(400, "totalAmount must be a non-negative number.");
    }

    const timestamp = new Date().toISOString();
    const order = await updateData((store) => {
      const created = {
        _id: `order_${randomUUID()}`,
        user_id: body.user_id || "Guest",
        waiter_id: null,
        recipient,
        status: orderDefaults.status || "PENDING",
        paymentStatus: orderDefaults.paymentStatus || "PENDING",
        waiter_settlement_status:
          orderDefaults.waiter_settlement_status || "UNSETTLED",
        items,
        totalAmount,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      store.orders.push(created);
      addOrderEvent(
        store,
        created,
        "ORDER_CREATED",
        "Order received",
        recipient,
        "CUSTOMER",
        timestamp,
      );
      return created;
    });
    sendJson(response, 201, order);
    return;
  }
  if (request.method === "GET" && /^\/order\/[^/]+\/events$/.test(pathname)) {
    const orderId = decodeURIComponent(pathname.slice("/order/".length, -"/events".length));
    if (!data.orders.some((order) => order._id === orderId)) {
      throw new ApiError(404, "Order not found.");
    }
    const events = data.orderEvents
      .filter((event) => event.order_id === orderId)
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
    sendJson(response, 200, events);
    return;
  }
  if (request.method === "PATCH" && /^\/order\/[^/]+$/.test(pathname)) {
    const orderId = decodeURIComponent(pathname.slice("/order/".length));
    const updates = validateOrderPatch(await readBody(request));
    const timestamp = new Date().toISOString();
    const updatedOrder = await updateData((store) => {
      const order = store.orders.find((entry) => entry._id === orderId);
      if (!order) throw new ApiError(404, "Order not found.");

      const previousWaiterId = order.waiter_id;
      const nextWaiterId =
        updates.waiter_id === undefined ? previousWaiterId : updates.waiter_id;
      const previousWaiterName = previousWaiterId
        ? waiterName(store, previousWaiterId)
        : null;
      const nextWaiterName = nextWaiterId
        ? waiterName(store, nextWaiterId)
        : null;
      if (nextWaiterId && !nextWaiterName) {
        throw new ApiError(404, "Waiter not found.");
      }

      const changes = Object.entries(updates)
        .filter(([field, value]) => JSON.stringify(order[field]) !== JSON.stringify(value))
        .map(([field, value]) => ({
          field,
          from: order[field],
          to: value,
        }));
      if (changes.length === 0) return order;

      const previousStatus = order.status;
      Object.assign(order, updates);
      order.updatedAt = timestamp;

      if (previousWaiterId !== nextWaiterId) {
        if (previousWaiterId) {
          addOrderEvent(
            store,
            order,
            "WAITER_DROPPED",
            "Waiter dropped the order",
            previousWaiterName || `Waiter ${previousWaiterId}`,
            "WAITER",
            timestamp,
          );
        }
        if (nextWaiterId) {
          addOrderEvent(
            store,
            order,
            "WAITER_ACCEPTED",
            "Waiter accepted the order",
            nextWaiterName,
            "WAITER",
            timestamp,
          );
        }
      }

      const statusChange = changes.find((change) => change.field === "status");
      if (statusChange) {
        const actorName =
          nextWaiterName || previousWaiterName || "Admin Portal";
        addOrderEvent(
          store,
          order,
          "ORDER_STATUS_CHANGED",
          `Status changed from ${previousStatus} to ${order.status}`,
          actorName,
          nextWaiterName || previousWaiterName ? "WAITER" : "ADMIN",
          timestamp,
          [statusChange],
        );
      }

      const otherChanges = changes.filter(
        (change) => change.field !== "status" && change.field !== "waiter_id",
      );
      if (otherChanges.length) {
        const labels = otherChanges.map(({ field }) =>
          ({
            paymentStatus: "payment status",
            waiter_settlement_status: "settlement status",
            totalAmount: "total amount",
            items: "items",
            recipient: "recipient",
          })[field] || field,
        );
        addOrderEvent(
          store,
          order,
          "ORDER_UPDATED",
          `Updated ${labels.join(", ")}`,
          nextWaiterName || previousWaiterName || "Admin Portal",
          nextWaiterName || previousWaiterName ? "WAITER" : "ADMIN",
          timestamp,
          otherChanges,
        );
      }
      return order;
    });
    sendJson(response, 200, updatedOrder);
    return;
  }
  if (request.method === "GET" && ["/order", "/orders"].includes(pathname)) {
    const filteredOrders = filterOrders(data.orders, url.searchParams).sort(
      (left, right) =>
        new Date(right.createdAt || 0).getTime() -
        new Date(left.createdAt || 0).getTime(),
    );
    const wantsPagination =
      url.searchParams.has("page") || url.searchParams.has("limit");

    if (!wantsPagination) {
      sendJson(response, 200, filteredOrders);
      return;
    }

    const requestedPage = Number.parseInt(
      url.searchParams.get("page") || "1",
      10,
    );
    const page = Number.isInteger(requestedPage) && requestedPage > 0
      ? requestedPage
      : 1;
    const limit = 10;
    const total = filteredOrders.length;
    const totalPages = Math.ceil(total / limit);
    const start = (page - 1) * limit;

    sendJson(response, 200, {
      orders: filteredOrders.slice(start, start + limit),
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasMore: page < totalPages,
      },
    });
    return;
  }
  if (request.method === "GET" && pathname === "/waiter") {
    sendJson(response, 200, data.waiters);
    return;
  }
  if (request.method === "PUT" && /^\/waiter\/[^/]+$/.test(pathname)) {
    const waiterId = decodeURIComponent(pathname.slice("/waiter/".length));
    const updates = validateWaiterUpdate(await readBody(request));
    const waiter = await updateData((store) => {
      const current = store.waiters.find((entry) => entry._id === waiterId);
      if (!current) throw new ApiError(404, "Waiter not found.");
      Object.assign(current, updates);
      return current;
    });
    sendJson(response, 200, waiter);
    return;
  }
  if (request.method === "GET" && pathname === "/waiter/requests") {
    const requestedStatus = url.searchParams.get("status");
    const requests = requestedStatus
      ? data.waiterRequests.filter((entry) => entry.status === requestedStatus.toUpperCase())
      : data.waiterRequests;
    sendJson(response, 200, requests);
    return;
  }
  if (request.method === "PATCH" && /^\/waiter\/requests\/[^/]+$/.test(pathname)) {
    const requestId = decodeURIComponent(pathname.slice("/waiter/requests/".length));
    const { decision } = await readBody(request);
    if (!["approve", "reject"].includes(decision)) {
      throw new ApiError(400, "decision must be either approve or reject.");
    }
    const updatedRequest = await updateData((store) => {
      const applicant = store.waiterRequests.find((entry) => entry._id === requestId);
      if (!applicant) throw new ApiError(404, "Waiter request not found.");
      if (applicant.status !== "PENDING") {
        throw new ApiError(409, "This waiter request has already been reviewed.");
      }

      applicant.status = decision === "approve" ? "APPROVED" : "REJECTED";
      applicant.reviewedAt = new Date().toISOString();
      if (decision === "approve") {
        store.waiters.push({
          _id: applicant._id,
          first_name: applicant.first_name,
          last_name: applicant.last_name || null,
          email: applicant.email,
          phone_number: applicant.phone_number || "",
          telegram_id: applicant.telegram_id,
          is_active: true,
        });
      }
      return applicant;
    });
    sendJson(response, 200, updatedRequest);
    return;
  }

  throw new ApiError(404, "Endpoint not found.");
}

data = await loadData();
const server = createServer((request, response) => {
  handleRequest(request, response).catch((error) => {
    if (response.headersSent) {
      response.destroy(error);
      return;
    }
    const status = error instanceof ApiError ? error.status : 500;
    if (status === 500) console.error(error);
    sendJson(response, status, {
      detail: status === 500 ? "Internal server error." : error.message,
    });
  });
});

server.listen(port, () => {
  console.log(`FastBites API listening on http://localhost:${port}`);
  console.log(`Persistent data file: ${dataFile}`);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
  });
}
