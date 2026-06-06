const assert = require('node:assert/strict');
const test = require('node:test');

const Order = require('../src/models/order.model');
const { handleSepayWebhook } = require('../src/controllers/payment.controller');

const mockResponse = () => ({
  statusCode: 200,
  payload: null,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(payload) {
    this.payload = payload;
    return this;
  },
});

const callWebhook = async (body, order, emittedEvents = []) => {
  const originalFindOne = Order.findOne;
  const res = mockResponse();
  let nextError;

  Order.findOne = async () => order;

  try {
    await handleSepayWebhook(
      {
        body,
        app: {
          get(name) {
            if (name !== 'io') {
              return undefined;
            }

            return {
              emit(eventName, payload) {
                emittedEvents.push({ eventName, payload });
              },
            };
          },
        },
      },
      res,
      (error) => {
        nextError = error;
      },
    );
  } finally {
    Order.findOne = originalFindOne;
  }

  if (nextError) {
    throw nextError;
  }

  return res;
};

const createOrder = (overrides = {}) => ({
  _id: 'order-id',
  orderCode: 'ABC123',
  totalAmount: 150000,
  paymentStatus: 'unpaid',
  paymentMethod: 'bank_transfer',
  saved: false,
  async save() {
    this.saved = true;
  },
  ...overrides,
});

test('SePay webhook with matching orderCode and enough amount marks order paid', async () => {
  const order = createOrder();
  const emittedEvents = [];
  const res = await callWebhook(
    {
      id: 'txn-1',
      transferAmount: 150000,
      content: 'Thanh toan READORA-ABC123',
    },
    order,
    emittedEvents,
  );

  assert.equal(res.statusCode, 200);
  assert.equal(order.paymentStatus, 'paid');
  assert.equal(order.paymentProvider, 'sepay');
  assert.equal(order.paymentTransactionId, 'txn-1');
  assert.equal(order.paymentNote, 'Thanh toan READORA-ABC123');
  assert.ok(order.paidAt instanceof Date);
  assert.equal(order.saved, true);
  assert.deepEqual(emittedEvents.map(({ eventName }) => eventName), ['admin:new-order', 'admin:payment-paid']);
});

test('SePay duplicate webhook returns 200 idempotently', async () => {
  const order = createOrder({ paymentStatus: 'paid' });
  const res = await callWebhook(
    {
      amount: 200000,
      description: 'READORA ABC123',
    },
    order,
  );

  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.success, true);
  assert.equal(order.saved, false);
});

test('SePay webhook with insufficient amount returns 400', async () => {
  const order = createOrder();
  const res = await callWebhook(
    {
      money: 149000,
      transaction_content: 'READORA-ABC123',
    },
    order,
  );

  assert.equal(res.statusCode, 400);
  assert.equal(order.paymentStatus, 'unpaid');
  assert.equal(order.saved, false);
});

test('SePay webhook for unknown order returns 404', async () => {
  const res = await callWebhook(
    {
      value: 150000,
      transferContent: 'READORA-UNKNOWN1',
    },
    null,
  );

  assert.equal(res.statusCode, 404);
});
