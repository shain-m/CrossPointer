const VK_RIGHT = 0x27;
const VK_LEFT = 0x25;
const VK_NEXT = 0x22;
const VK_PRIOR = 0x21;
const VK_F5 = 0x74;
const VK_ESCAPE = 0x1b;
const VK_B = 0x42;
const VK_L = 0x4c;
const VK_F = 0x46;
const VK_CONTROL = 0xa2;
const VK_SHIFT = 0xa0;

const PROFILES = {
  powerpoint: {
    next: [{ key: VK_NEXT }],
    previous: [{ key: VK_PRIOR }],
    start: [{ key: VK_F5 }],
    exit: [{ key: VK_ESCAPE }],
    blank: [{ key: VK_B }],
  },
  'google-slides': {
    next: [{ key: VK_RIGHT }],
    previous: [{ key: VK_LEFT }],
    start: [{ key: VK_CONTROL }, { key: VK_SHIFT }, { key: VK_F5 }],
    blank: [{ key: VK_B }],
    exit: [{ key: VK_ESCAPE }],
  },
  'pdf-viewer': {
    next: [{ key: VK_NEXT }],
    previous: [{ key: VK_PRIOR }],
    start: [{ key: VK_CONTROL }, { key: VK_L }],
    exit: [{ key: VK_ESCAPE }],
    blank: [{ key: VK_ESCAPE }],
  },
};

function getPresentationProfile(profileId) {
  if (!Object.prototype.hasOwnProperty.call(PROFILES, profileId)) {
    throw new Error(`Unknown presentation profile: ${profileId}.`);
  }
  return PROFILES[profileId];
}

module.exports = { getPresentationProfile, presentationProfileIds: Object.keys(PROFILES) };
