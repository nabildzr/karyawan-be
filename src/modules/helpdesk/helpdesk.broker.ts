type HelpdeskBrokerEvent = {
  event: string;
  ticketId: string;
  data: unknown;
  source: string;
};

type IncomingHandler = (payload: HelpdeskBrokerEvent) => void;

const AMQP_URL = process.env.AMQP_URL ?? "amqp://guest:guest@rabbitmq:5672";
const EXCHANGE_NAME = "helpdesk.events";
const INSTANCE_ID = `helpdesk-${Math.random().toString(36).slice(2, 10)}`;

let connection: any = null;
let channel: any = null;
let initialized = false;
let incomingHandler: IncomingHandler | null = null;

export async function initHelpdeskBroker() {
  if (initialized) return;
  initialized = true;

  try {
    const amqplib = await import("amqplib");
    connection = await amqplib.connect(AMQP_URL);
    channel = await connection.createChannel();

    connection.on("close", () => {
      connection = null;
      channel = null;
      initialized = false;
    });
    connection.on("error", () => {
      connection = null;
      channel = null;
      initialized = false;
    });

    await channel.assertExchange(EXCHANGE_NAME, "fanout", { durable: false });
    const queue = await channel.assertQueue("", { exclusive: true });
    await channel.bindQueue(queue.queue, EXCHANGE_NAME, "");

    await channel.consume(
      queue.queue,
      (message: any) => {
        if (!message) return;
        try {
          const payload = JSON.parse(message.content.toString()) as HelpdeskBrokerEvent;
          if (payload.source === INSTANCE_ID) return;
          incomingHandler?.(payload);
        } catch {
          // ignore malformed payload
        }
      },
      { noAck: true },
    );
  } catch {
    connection = null;
    channel = null;
    initialized = false;
  }
}

export function onIncomingHelpdeskEvent(handler: IncomingHandler) {
  incomingHandler = handler;
}

export async function publishHelpdeskEvent(event: string, ticketId: string, data: unknown) {
  if (!channel) return;
  try {
    const payload: HelpdeskBrokerEvent = {
      event,
      ticketId,
      data,
      source: INSTANCE_ID,
    };
    channel.publish(EXCHANGE_NAME, "", Buffer.from(JSON.stringify(payload)));
  } catch {
    // swallow broker publish error to keep chat flow alive
  }
}

