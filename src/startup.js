import sendOrderEmail from "./util/sendOrderEmail.js";
import { getExceptionFuzzy, exceptionList } from "./templates.js";

/**
 * @summary Called on startup
 * @param {Object} context Startup context
 * @param {Object} context.collections Map of MongoDB collections
 * @returns {undefined}
 */
let supportEmail = process.env["ORDER_NOTIFY_EMAIL"];
export default async function ordersStartup(context) {
  const { appEvents } = context;

  if (!supportEmail) {
    const primaryShop = await context.queries.primaryShop(context.getInternalContext());
    if (primaryShop && primaryShop.emails && primaryShop.emails.length > 0) {
      supportEmail = primaryShop.emails[0].address || ''
    }
  }
  console.log("Using support email: ", supportEmail)
  appEvents.on(
    "afterOrderCreate",
    ({ order }) => updated(context, order, "new"),
  );
  registerEvent("afterOrderUpdate", ({ order }) => updated(context, order));
  registerEvent("afterOrderCancel", ({ order }) => sendOrderEmail(context, order, 'canceled'));
  registerEvent("afterExceptionRegistered", ({ order }) => sendExceptionEmail(context, order))

  function registerEvent(event, cb) {
    appEvents.on(event, cb)
  }
}

function getContactInfo(order) {
  const fullName = (order && order.payments && order.payments.length > 0 && order.payments[0].address.fullName) || "";
  const firstName = (order && order.payments && order.payments.length > 0 && order.payments[0].address.firstName);
  const phone = (order && order.payments && order.payments.length > 0 && order.payments[0].address.phone) || "";
  const recepientPhone = (order && order.shipping && order.shipping.length > 0 && order.shipping[0].address && order.shipping[0].address.phone) || "";

  return {
    firstName: firstName || fullName.split(" ")[0],
    fullName,
    phone,
    recepientPhone,
  }
}

function sendExceptionEmail(context, order) {
  const { firstName, recepientPhone } = getContactInfo(order);
  const exceptions = order.exceptionNotes || [];
  if (exceptions.length === 0) {
    console.error("Exception notes is empty but order exception was trigerred.")
    return;
  }

  const exception = order.exception;
  const templates = getExceptionFuzzy(exception.content); //?.[0]?.original;
  if (templates.length === 0) {
    console.error("Can't select templatename from given exception: ", exception.content)
    return
  }

  const template = templates[0].original;
  const msg = exceptionList[template]({ receiverPhone: recepientPhone });
  const welcomeMessage = formatWelcomeMessage(firstName, msg);
  order = { ...order, welcomeMessage };
  sendOrderEmail(context, order, "new-exception");
  if (supportEmail) {
    sendOrderEmail(context, Object.assign({}, order, { email: supportEmail }), "new-exception");
  }
}

const formatWelcomeMessage = (name, msg) => `Dear ${name}, <br/>${msg}`;

const emailActions = ["new", "shipped", "completed"]
function updated(context, order, action) {
  action = action || order.action || order.workflow.status;
  action = action.replace("coreOrderWorkflow/", "");
  if (!emailActions.includes(action)) {
    return;
  }

  const { firstName } = getContactInfo(order);
  const actionToMsg = {
    new: "Your order was created. We will keep updating as your order progresses.",
    shipped: "Our team is preparing to deliver your gift today. We will send your another email after we complete your order.",
    completed: "Congratulations. Your order has successfully reached its destination."
  };
  const actionMessage = actionToMsg[action] || action;
  const welcomeMessage = formatWelcomeMessage(firstName, actionMessage);

  if (order.imageRequested && order.videoRequested) {
    const videos = order.requestedVideoUrls || [];
    const images = order.requestedImageUrls || [];
    if (videos.length === 0 && images.length === 0) {
      order = { ...order, requestedMediaMessage: "Receiver declined your request for photo and video." }
    }
  }

  order = { ...order, welcomeMessage };
  if (order.deliveryUrgency === "As soon as possible") {
    order = {
      ...order,
      preferredDeliveryDate: "As soon as possible"
    }
  } else {
    const options = {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "2-digit"
    }
    const preferredDeliveryDate = order.preferredDeliveryDate.toLocaleDateString("en-CA", options);
    order = {
      ...order,
      preferredDeliveryDate,
    }
  }
  sendOrderEmail(context, order, action);
  if (supportEmail && action === "new") {
    sendOrderEmail(context, Object.assign({}, order, { email: supportEmail }), "new-admin");
  }
}
