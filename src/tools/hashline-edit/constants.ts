export const NIBBLE_STR = 'ZPMQVRWSNKTXJBYH';

export const HASH_ALPHABET = NIBBLE_STR;
// Pre-compiled regex for matching 2-char hash
export const HASH_PATTERN = new RegExp(`^[${NIBBLE_STR}]{2}$`);
export const HASH_CAPTURE_PATTERN = new RegExp(`([0-9]+#[${NIBBLE_STR}]{2})`);
export const HASH_SUFFIX_PATTERN = new RegExp(`#([${NIBBLE_STR}]{2})$`);

export const HASHLINE_DICT = Array.from({ length: 256 }, (_, i) => {
  const high = i >>> 4;
  const low = i & 0x0f;
  return `${NIBBLE_STR[high]}${NIBBLE_STR[low]}`;
});

export const HASHLINE_REF_PATTERN = /^([0-9]+)#([ZPMQVRWSNKTXJBYH]{2})$/;
export const HASHLINE_OUTPUT_PATTERN =
  /^([0-9]+)#([ZPMQVRWSNKTXJBYH]{2})\|(.*)$/;
