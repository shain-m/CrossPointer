const koffi = require('koffi');

const INPUT_MOUSE = 0;
const MOUSEEVENTF_MOVE = 0x0001;
const MOUSEEVENTF_LEFTDOWN = 0x0002;
const MOUSEEVENTF_LEFTUP = 0x0004;
const MOUSEEVENTF_RIGHTDOWN = 0x0008;
const MOUSEEVENTF_RIGHTUP = 0x0010;
const MOUSEEVENTF_WHEEL = 0x0800;
const MIN_SIGNED_LONG = -2147483648;
const MAX_SIGNED_LONG = 2147483647;
const MIN_WHEEL_DELTA = -1200;
const MAX_WHEEL_DELTA = 1200;

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

function mouseEvent(dx, dy, mouseData, flags) {
  validateInteger(dx, MIN_SIGNED_LONG, MAX_SIGNED_LONG, 'dx');
  validateInteger(dy, MIN_SIGNED_LONG, MAX_SIGNED_LONG, 'dy');
  validateInteger(mouseData, 0, 0xffffffff, 'mouseData');
  validateInteger(flags, 0, 0xffffffff, 'flags');

  const event = {
    type: INPUT_MOUSE,
    u: {
      mi: {
        dx,
        dy,
        mouseData,
        dwFlags: flags,
        time: 0,
        dwExtraInfo: 0,
      },
    },
  };
  const sent = SendInput(1, [event], koffi.sizeof(INPUT));
  if (sent !== 1) {
    throw new Error(`SendInput failed: sent ${sent} of 1 event.`);
  }
}

function moveRelative(deltaX, deltaY) {
  validateInteger(deltaX, MIN_SIGNED_LONG, MAX_SIGNED_LONG, 'deltaX');
  validateInteger(deltaY, MIN_SIGNED_LONG, MAX_SIGNED_LONG, 'deltaY');
  mouseEvent(deltaX, deltaY, 0, MOUSEEVENTF_MOVE);
}

function click(button) {
  const flags = button === 'left'
    ? [MOUSEEVENTF_LEFTDOWN, MOUSEEVENTF_LEFTUP]
    : button === 'right'
      ? [MOUSEEVENTF_RIGHTDOWN, MOUSEEVENTF_RIGHTUP]
      : null;
  if (flags === null) {
    throw new Error('button must be left or right.');
  }
  mouseEvent(0, 0, 0, flags[0]);
  mouseEvent(0, 0, 0, flags[1]);
}

function scroll(amount) {
  validateInteger(amount, MIN_WHEEL_DELTA, MAX_WHEEL_DELTA, 'amount');
  const mouseData = amount < 0 ? 0x100000000 + amount : amount;
  mouseEvent(0, 0, mouseData, MOUSEEVENTF_WHEEL);
}

module.exports = {
  click,
  moveRelative,
  scroll,
};
