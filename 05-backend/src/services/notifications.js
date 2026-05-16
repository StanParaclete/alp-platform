// Notification service
export async function notifyFamily({ studentId, type, message, alpId }) {
  console.log(`[notify] Family notification | student: ${studentId} | type: ${type}`);
  return { sent: true };
}
export async function sendPushNotification({ userId, title, body, data }) {
  console.log(`[notify] Push to user ${userId}: ${title}`);
  return { sent: true };
}
