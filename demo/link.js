
const emptyFunc = () => undefined;

const TYPE_CALL = 1;
const TYPE_RETURN = 2;

const wm = new Map();
let sentNonce;
const createNonce = (call) => {
  const ch = new MessageChannel();
  return ch.port1;
};

const readNonce = (nonce) => {
  return -1;
};



class Link {
  constructor(handler) {
    this._pending = new Map();
    this._lookup = [handler];
    this._call = 0;

    this._onmessage = this._onmessage.bind(this);
  }

  _register(fn) {
    this._lookup.push(fn);
    return this._lookup.length - 1;
  }

  async _internalCall(port, id, ...args) {
    const call = ++this._call;

    // Find callables and add them to our lookup.
    // TODO(samthor): This is fine, but will grow infinitely. Oh well.
    // For comparison, Comlink makes you wrap every callable in a `Comlink.proxy` method,
    // which means you must later release it.
    const nonces = [];
    args = await Promise.all(args.map(async (arg) => {
      if (typeof arg !== 'function') {
        return arg;
      }

      const nonce = await createNonce(call);
      console.info('saving', nonce);
      wm.set(nonce, call);
      sentNonce = nonce;
      nonces.push(nonce);
      return nonce;
    }));

    port.postMessage([TYPE_CALL, nonces, id, call, args], nonces);

    // wait for the reply
    return new Promise((resolve) => this._pending.set(call, resolve));
  }

  attach(port) {
    port.onmessage = this._onmessage.bind(this, port);
    return this._internalCall.bind(this, port, 0);
  }

  _incoming(port, nonces, id, call, args) {
    const handler = this._lookup[id] || emptyFunc;

    args = args.map((arg) => {
      const i = nonces.indexOf(arg);
      if (i === -1) {
        return arg;
      }

      const call = readNonce(arg[i]);
      return () => { throw 'broken for now'; }
      return (...args) => this._internalCall(port, call, ...args);
    });

    // FIXME: If JavaScript had tractable GC, then we'd watch the passed callables, and tell the
    // caller when we're done with them. Oh well!

    Promise.resolve(handler(...args)).then((value) => {
      port.postMessage([TYPE_RETURN, call, value, nonces], nonces);
    });
  }

  _result(port, call, value, nonces) {
    nonces.forEach((nonce) => {
      console.info('looking up', nonce, wm.get(nonce), nonce === sentNonce);
    });
    console.info(wm);
    debugger;

    const handler = this._pending.get(call);
    if (handler === undefined) {
      throw new Error(`unknown call: ${call}`);
    }
    this._pending.delete(call);
    handler(value);
  }

  /**
   * @param {!MessagePort} port
   * @param {!MessageEvent} event
   */
  _onmessage(port, event) {
    const type = event.data.shift();
    switch (type) {
      case TYPE_CALL:
        this._incoming(port, ...event.data);
        break;

      case TYPE_RETURN:
        this._result(port, ...event.data);
        break;

      default:
        throw new Error(`unhandled port message: ${type}`);
    }
  }
}

export default function buildLink(fn) {
  const link = new Link(fn);
  return (port) => link.attach(port);
}
