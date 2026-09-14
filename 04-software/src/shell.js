const message = document.getElementById('message');
const retry = document.getElementById('retry');
retry.addEventListener('click', () => window.alpDesktop.retry());
document.getElementById('credit').addEventListener('click', event => { event.preventDefault(); window.alpDesktop.openCredit(); });
window.alpDesktop.onStatus(status => {
  retry.hidden = status !== 'unavailable';
  message.textContent = status === 'unavailable' ? 'ALP could not connect. Check your internet connection, then try again. Your school records have not been stored on this device.' : 'Connecting to your workspace...';
});
