import { instance, PhoneNumberFormat } from '../util/libphonenumberInstance';

export function format(
  phoneNumber: string,
  options: {
    ourRegionCode: string;
  }
) {
  try {
    const { ourRegionCode } = options;
    const parsedNumber = instance.parse(phoneNumber);
    const regionCode = instance.getRegionCodeForNumber(parsedNumber);

    if (ourRegionCode && regionCode === ourRegionCode) {
      // changed: random phonenumber,just show as international format.
      //  return instance.format(parsedNumber, PhoneNumberFormat.NATIONAL);
    }

    return instance.format(parsedNumber, PhoneNumberFormat.INTERNATIONAL);
  } catch (error) {
    return phoneNumber;
  }
}

export function parse(
  phoneNumber: string,
  options: {
    regionCode: string;
  }
): string {
  const { regionCode } = options;
  const parsedNumber = instance.parse(phoneNumber, regionCode);

  if (instance.isValidNumber(parsedNumber)) {
    return instance.format(parsedNumber, PhoneNumberFormat.E164);
  }

  return phoneNumber;
}

export function normalize(
  phoneNumber: string,
  options: { regionCode: string }
): string | undefined {
  const { regionCode } = options;
  try {
    const parsedNumber = instance.parse(phoneNumber, regionCode);

    if (instance.isValidNumber(parsedNumber)) {
      return instance.format(parsedNumber, PhoneNumberFormat.E164);
    }

    return;
  } catch (error) {
    return;
  }
}
