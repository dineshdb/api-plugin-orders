import fuzzy from "fuzzy";


export const exceptionList = {
    "Receiver didn't receive the call": (order) =>
      `We couldn't contact the receiver at ${order.receiverPhone} becasue our call wasn't answered. Please provide alternative phone at +1-775-600-1040.`,
    "Receiver's phone is switched off": (order) =>
      `We couldn't contact the receiver at ${order.receiverPhone} becasue the phone is switched off. Please provide alternative phone at +1-775-600-1040.`,
    "Receiver is out of valley": (_order) =>
      `We couldn't deliver your gift today because they are out of valley\nWe will reschedule the delivery. Or provide us another contact detail.`,
    "Receiver's phone number is incorrect": (order) =>
      `We couldn't contact the receiver at ${order.receiverPhone} becasue the number was wrong. Please provide alternative phone at +1-775-600-1040.`,
};
const exceptionListKeys = Object.keys(exceptionList);


export function getExceptionFuzzy(input) {
    return fuzzy.filter(input, exceptionListKeys);
  }