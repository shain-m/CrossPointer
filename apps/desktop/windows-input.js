const koffi = require('koffi');

/**
 * @typedef {'left' | 'right' | 'middle'} MouseButton
 * @typedef {'next' | 'previous' | 'start' | 'exit' | 'blank'} PresentationAction
 * @typedef {{
 *   moveRelative: (dx: number, dy: number) => void,
 *   buttonDown: (button: MouseButton) => void,
 *   buttonUp: (button: MouseButton) => void,
 *   click: (button: MouseButton) => void,
 *   scroll: (deltaX: number, deltaY: number) => void,
 *   pressPresentationAction: (action: PresentationAction) => void,
 *   releaseAllHeldInputs: () => void,
 *   getCapabilities: () => {
 *     platform: string,
 *     relativeMove: boolean,
 *     absoluteLaser: boolean,
 *     presentationKeys: boolean,
 *     supportedPresentationActions: PresentationAction[],
 *   },
 * }} HostInputAdapter
 */

const INPUT_MOUSE = 0;
const INPUT_KEYBOARD = 1;
const MOUSEEVENTF_MOVE = 0x0001;
const MOUSEEVENTF_LEFTDOWN = 0x0002;
const MOUSEEVENTF_LEFTUP = 0x0004;
const MOUSEEVENTF_RIGHTDOWN = 0x0008;
const MOUSEEVENTF_RIGHTUP = 0x0010;
const MOUSEEVENTF_MIDDLEDOWN = 0x0020;
const MOUSEEVENTF_MIDDLEUP = 0x0040;
const MOUSEEVENTF_WHEEL = 0x0800;
const MOUSEEVENTF_HWHEEL = 0x1000;
const KEYEVENTF_KEYUP = 0x0002;
const VK_NEXT = 0x22;
const VK_PRIOR = 0x21;
const VK_F5 = 0x74;
const VK_ESCAPE = 0x1b;
const VK_B = 0x42;
const MIN_SIGNED_LONG = -2147483648;
const MAX_SIGNED_LONG = 2147483647;
const MIN_WHEEL_DELTA = -1200;
const MAX_WHEEL_DELTA = 1200;
const BUTTON_FLAGS = {
  left: [MOUSEEVENTF_LEFTDOWN, MOUSEEVENTF_LEFTUP],
  right: [MOUSEEVENTF_RIGHTDOWN, MOUSEEVENTF_RIGHTUP],
  middle: [MOUSEEVENTF_MIDDLEDOWN, MOUSEEVENTF_MIDDLEUP],
};
const PRESENTATION_KEYS = {
  next: VK_NEXT,
  previous: VK_PRIOR,
  start: VK_F5,
  exit: VK_ESCAPE,
  blank: VK_B,
};

const user32 = koffi.load('user32.dll');
const MOUSEINPUT = koffi.struct('CrossPointerMOUSEINPUT', {
  dx: 'long',
  dy: 'long',
  mouseData: 'uint32_t',
  dwFlags: 'uint32_t',
  time: 'uint32_t',
  dwExtraInfo: 'uintptr_t',
});
const KEYBDINPUT = koffi.struct('CrossPointerKEYBDINPUT', {
  wVk: 'uint16_t',
  wScan: 'uint16_t',
  dwFlags: 'uint32_t',
  time: 'uint32_t',
  dwExtraInfo: 'uintptr_t',
});
const HARDWAREINPUT = koffi.struct('CrossPointerHARDWAREINPUT', {
  uMsg: 'uint32_t',
  wParamL: 'uint16_t',
  wParamH: 'uint16_t',
});
const INPUT = koffi.struct('CrossPointerINPUT', {
  type: 'uint32_t',
  u: koffi.union({
    mi: MOUSEINPUT,
    ki: KEYBDINPUT,
    hi: HARDWAREINPUT,
  }),
});
const SendInput = user32.func(
  'unsigned int __stdcall SendInput(unsigned int cInputs, CrossPointerINPUT *pInputs, int cbSize)',
);

function validateInteger(value, minimum, maximum, name) {
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${name} must be an integer between ${minimum} and ${maximum}.`);
  }
  return value;
}

function validateButton(button) {
  if (!Object.prototype.hasOwnProperty.call(BUTTON_FLAGS, button)) {
    throw new Error('button must be left, right, or middle.');
  }
  return button;
}

function validatePresentationAction(action) {
  if (!Object.prototype.hasOwnProperty.call(PRESENTATION_KEYS, action)) {
    throw new Error('action must be next, previous, start, exit, or blank.');
  }
  return action;
}

function sendInput(events) {
  const sent = SendInput(events.length, events, koffi.sizeof(INPUT));
  if (sent !== events.length) {
    throw new Error(`SendInput failed: sent ${sent} of ${events.length} events.`);
  }
}

function createMouseEvent(dx, dy, mouseData, flags) {
  validateInteger(dx, MIN_SIGNED_LONG, MAX_SIGNED_LONG, 'dx');
  validateInteger(dy, MIN_SIGNED_LONG, MAX_SIGNED_LONG, 'dy');
  validateInteger(mouseData, 0, 0xffffffff, 'mouseData');
  validateInteger(flags, 0, 0xffffffff, 'flags');
  return {
    type: INPUT_MOUSE,
    u: {
      mi: { dx, dy, mouseData, dwFlags: flags, time: 0, dwExtraInfo: 0 },
    },
  };
}

function createKeyboardEvent(virtualKey, flags) {
  return {
    type: INPUT_KEYBOARD,
    u: {
      ki: { wVk: virtualKey, wScan: 0, dwFlags: flags, time: 0, dwExtraInfo: 0 },
    },
  };
}

/** @returns {HostInputAdapter} */
function createWindowsHostInputAdapter() {
  const heldButtons = new Set();
  const heldKeys = new Set();

  function sendMouse(dx, dy, mouseData, flags) {
    sendInput([createMouseEvent(dx, dy, mouseData, flags)]);
  }

  function moveRelative(deltaX, deltaY) {
    validateInteger(deltaX, MIN_SIGNED_LONG, MAX_SIGNED_LONG, 'deltaX');
    validateInteger(deltaY, MIN_SIGNED_LONG, MAX_SIGNED_LONG, 'deltaY');
    sendMouse(deltaX, deltaY, 0, MOUSEEVENTF_MOVE);
  }

  function buttonDown(button) {
    const validatedButton = validateButton(button);
    if (heldButtons.has(validatedButton)) {
      return;
    }
    sendMouse(0, 0, 0, BUTTON_FLAGS[validatedButton][0]);
    heldButtons.add(validatedButton);
  }

  function buttonUp(button) {
    const validatedButton = validateButton(button);
    sendMouse(0, 0, 0, BUTTON_FLAGS[validatedButton][1]);
    heldButtons.delete(validatedButton);
  }

  function click(button) {
    const validatedButton = validateButton(button);
    buttonDown(validatedButton);
    buttonUp(validatedButton);
  }

  function scroll(deltaX, deltaY) {
    validateInteger(deltaX, MIN_WHEEL_DELTA, MAX_WHEEL_DELTA, 'deltaX');
    validateInteger(deltaY, MIN_WHEEL_DELTA, MAX_WHEEL_DELTA, 'deltaY');
    if (deltaX !== 0) {
      sendMouse(0, 0, deltaX < 0 ? 0x100000000 + deltaX : deltaX, MOUSEEVENTF_HWHEEL);
    }
    if (deltaY !== 0) {
      sendMouse(0, 0, deltaY < 0 ? 0x100000000 + deltaY : deltaY, MOUSEEVENTF_WHEEL);
    }
  }

  function pressKey(virtualKey) {
    sendInput([createKeyboardEvent(virtualKey, 0)]);
    heldKeys.add(virtualKey);
    try {
      sendInput([createKeyboardEvent(virtualKey, KEYEVENTF_KEYUP)]);
      heldKeys.delete(virtualKey);
    } catch (error) {
      throw new Error(`Failed to release presentation key ${virtualKey}: ${error.message}`);
    }
  }

  function pressPresentationAction(action) {
    const validatedAction = validatePresentationAction(action);
    pressKey(PRESENTATION_KEYS[validatedAction]);
  }

  function releaseAllHeldInputs() {
    const failures = [];
    for (const button of heldButtons) {
      try {
        sendMouse(0, 0, 0, BUTTON_FLAGS[button][1]);
        heldButtons.delete(button);
      } catch (error) {
        failures.push(`button ${button}: ${error.message}`);
      }
    }
    for (const virtualKey of heldKeys) {
      try {
        sendInput([createKeyboardEvent(virtualKey, KEYEVENTF_KEYUP)]);
        heldKeys.delete(virtualKey);
      } catch (error) {
        failures.push(`key ${virtualKey}: ${error.message}`);
      }
    }
    if (failures.length > 0) {
      throw new Error(`Failed to release held inputs: ${failures.join('; ')}`);
    }
  }

  return {
    moveRelative,
    buttonDown,
    buttonUp,
    click,
    scroll,
    pressPresentationAction,
    releaseAllHeldInputs,
    getCapabilities: () => ({
      platform: 'Windows 10/11',
      relativeMove: true,
      absoluteLaser: true,
      presentationKeys: true,
      supportedPresentationActions: Object.keys(PRESENTATION_KEYS),
    }),
  };
}

module.exports = createWindowsHostInputAdapter();
