// File bytes live in this tab through client-side navigation and local sign-in.
let staged: { id: string; file: File } | undefined;
export function stageFile(file: File) {
  const id = crypto.randomUUID();
  staged = { id, file };
  return id;
}
export function stagedFile(id: string | null) {
  return id && staged?.id === id ? staged.file : null;
}
export function discardFile(id: string | null) {
  if (id && staged?.id === id) staged = undefined;
}

const invitationType = 'openprint:model-offer:v1';
const requestType = 'openprint:model-request:v1';
const maxBytes = 20 * 1024 * 1024;
export function offerModel(target: URL, file: File, onExpired: () => void) {
  const token = crypto.randomUUID();
  target.hash = new URLSearchParams({ transfer: token, source: location.origin }).toString();
  const child = window.open('about:blank', '_blank');
  if (!child) return null;
  // Detach the opener while the new window is still ours, before any peer code can run.
  child.opener = null;
  child.location.replace(target.href);
  const invite = window.setInterval(() => {
    if (child.closed) {
      stop();
      onExpired();
      return;
    }
    child.postMessage({ type: invitationType, token }, target.origin);
  }, 500);
  const timer = window.setTimeout(() => {
    stop();
    onExpired();
  }, 120_000);
  function stop() {
    window.clearTimeout(timer);
    window.clearInterval(invite);
    window.removeEventListener('message', send);
  }
  function send(event: MessageEvent) {
    if (
      event.origin !== target.origin ||
      event.source !== child ||
      event.data?.type !== requestType ||
      event.data.token !== token ||
      event.ports.length !== 1
    )
      return;
    stop();
    // Reply on the requesting document's port. A subsequent navigation cannot receive these bytes.
    event.ports[0].postMessage(file);
    event.ports[0].close();
  }
  window.addEventListener('message', send);
  return stop;
}

/** Wait for an origin-bound invitation. Only a click in the receiving editor requests the bytes. */
export function listenForModel(fragment: URLSearchParams, ready: (source: Window) => void) {
  const origin = fragment.get('source'),
    token = fragment.get('transfer');
  function invitation(event: MessageEvent) {
    if (
      !origin ||
      !token ||
      event.origin !== origin ||
      event.data?.type !== invitationType ||
      event.data.token !== token ||
      !event.source ||
      !('closed' in event.source)
    )
      return;
    ready(event.source as Window);
    window.removeEventListener('message', invitation);
  }
  window.addEventListener('message', invitation);
  return () => window.removeEventListener('message', invitation);
}

export function receiveModel(fragment: URLSearchParams, sender: Window): Promise<File> {
  const source = new URL(fragment.get('source') || '');
  const token = fragment.get('transfer');
  if (!token || !/^https?:$/.test(source.protocol) || source.origin !== fragment.get('source'))
    throw new Error('Model transfer unavailable / Передача модели недоступна');
  const channel = new MessageChannel();
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      channel.port1.close();
      reject(new Error('Open the local file again / Откройте локальный файл заново'));
    }, 5000);
    channel.port1.onmessage = (event) => {
      window.clearTimeout(timer);
      channel.port1.close();
      const file = event.data;
      if (
        file instanceof File &&
        file.size > 0 &&
        file.size <= maxBytes &&
        /\.(stl|obj)$/i.test(file.name)
      ) {
        resolve(file);
      } else reject(new Error('Invalid model file / Некорректный файл модели'));
    };
    sender.postMessage({ type: requestType, token }, source.origin, [channel.port2]);
  });
}
