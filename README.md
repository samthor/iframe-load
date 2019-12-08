Swappable iframe loader, inspired by [Santa Tracker](https://santatracker.google.com) 🎅

Provides a JS class which loads and can swap between hosted iframes.
This is useful for sites which are "hosts" for games or other experiences (which can be useful to isolate parts of your site).

# Usage

```js
import {Loader, LoaderHandler} from 'iframe-load';

const handler = new (class extends LoaderHandler {
  // optional callbacks here, see main.js
});

const container = document.body;  // or somewhere in DOM to place <iframe>
const loader = new Loader(container, handler);


loader.load('./page.html', context).then((result) => {
  if (result === undefined) {
    // was preempted by some other load
  } else {
    // otherwise, the iframe's load event was called (or the frame failed to load)
  }
});
```

By default, the loader sets `tabindex="-1"` and a style of `pointer-events: none` on any frame while it is disabled.
This can be overridden (along with other helpers) by subclassing `Loader` and changing its static helpers.

## Advanced

The created loader can have its `.disabled` property set to disable user interaction with its frames.
It also has method `.focus()` and property `.hasFocus`.

# TODO

This readme is fairly sparse.
