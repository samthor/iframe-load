
const emptyPageHref = 'data:text/html;base64,';
const removeNonce = new Object();

export class Loader {

  /**
   * @param {!HTMLElement} container
   */
  constructor(container) {
    this._container = container;
    this._disabled = false;

    this._activeFrame = this.constructor.createFrame(emptyPageHref);
    this._activeHref = emptyPageHref;
    this._previousFrame = null;
    this._previousFrameUnload = Promise.resolve();

    this._container.appendChild(this._activeFrame);

    this._container.addEventListener('focusin', (e) => {
      console.warn('container focus');
    }, {capture: true})
  }

  /**
   * Creates a new frame.
   *
   * @param {?string} href
   * @return {!HTMLIFrameElement}
   */
  static createFrame(href) {
    const iframe = document.createElement('iframe');
    iframe.src = href;
    iframe.setAttribute('sandbox', 'allow-forms allow-same-origin allow-scripts allow-popups allow-top-navigation allow-top-navigation-by-user-activation');
    iframe.setAttribute('allow', 'autoplay');  // ... ignored in Safari
    iframe.setAttribute('referrerpolicy', 'no-referrer-when-downgrade');
    return iframe;
  }

  /**
   * Delays the removal of a previous frame (and the completion of load).
   * 
   * @param {!HTMLIFrameElement} frame
   * @param {?string} href
   */
  static async unload(frame, href) {
    // does nothing by default
  }

  /**
   * Allows the iframe to be configured. Delays load return, and can be preempted. This is called
   * before the 'load' event is first received.
   *
   * @param {!HTMLIFrameElement} frame
   * @param {?string} href
   */
  static async prepare(frame, href) {
    // does nothing by default
  }

  get isLoading() {
    return this._previousFrame !== null;
  }

  set disabled(v) {
    this._disabled = v;
    if (v) {
      window.focus();  // ensure activeFrame isn't focused
      this._activeFrame.setAttribute('tabindex', -1);
    } else if (!this.isLoading) {
      // tabindex should remain -1 during loading.
      this._activeFrame.removeAttribute('tabindex');
    }
  }

  get disabled() {
    return this._disabled;
  }

  /**
   * Load a new frame with the given URL.
   *
   * @param {?string} href
   * @return {!Promise<void>}
   */
  async load(href) {
    if (this._previousFrame) {
      // If there was still a previousFrame set, then the last activeFrame never loaded. This event
      // is listened to for below.
      // The previousFrame might already be removed at this point, but it's still non-null.
      this._activeFrame.dispatchEvent(new CustomEvent('-remove', {detail: removeNonce}));
      this._container.removeChild(this._activeFrame);
    } else {
      // Move the current activeFrame to be our previousFrame.
      this._previousFrame = this._activeFrame;
      this._previousFrame.setAttribute('tabindex', -1);
      window.focus();  // ensure previousFrame isn't focused
      this._previousFrameUnload = this.constructor.unload(this._previousFrame, this._activeHref);

      // Once done, remove the frame. We block until after this Promise anyway.
      this._previousFrameUnload.then(() => this._container.removeChild(this._previousFrame));
    }

    const frame = this.constructor.createFrame(href || emptyPageHref);
    frame.setAttribute('tabindex', -1);
    this._container.appendChild(frame);
    this._activeFrame = frame;
    this._activeHref = href;

    const preempted = await new Promise((resolve, reject) => {
      const localUnload = this._previousFrameUnload;
      const framePrepare = this.constructor.prepare(frame, href);
      let loaded = false;

      const loadHandler = () => {
        if (!loaded) {
          loaded = true;

          // Don't resolve the promise early, as this would prevent the preempt check; wait until
          // unload is complete, prepare is done, and then call resolve or reject.
          return Promise.resolve()
              .then(() => localUnload)
              .then(() => framePrepare)
              .then(() => resolve(false))
              .catch(reject);
        }

        // Don't allow further loads of other pages. We can't prevent them from happening, but nuke
        // the page once it loads.
        frame.contentWindow.location.replace(emptyPageHref);
        frame.removeEventListener('load', loadHandler);
      };
      frame.addEventListener('load', loadHandler);
      frame.addEventListener('-remove', (ev) => {
        if (ev.detail === removeNonce) {
          resolve(true);
        }
      });
    });
    if (preempted) {
      return null;  // this frame was preempted by another
    }

    if (!this._disabled) {
      frame.removeAttribute('tabindex');
    }
    this._previousFrame = null;
    return frame;
  }

  /**
   * @return {boolean} whether the active frame has focus
   */
  get hasFocus() {
    // This is impossible to listen to. It's possible to determine whether focus transitions from
    // the current window to ANY frame, but then focus changes _between_ frames aren't visible, as
    // there's no useful intermediate state.
    return document.activeElement === this._activeFrame;
  }

  /**
   * Maybe cause focus on the active frame, if it's loaded.
   */
  focus() {
    if (!this._activeFrame.hasAttribute('tabindex')) {
      this._activeFrame.focus();
    }
  }
}