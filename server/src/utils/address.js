export function composeFullAddress({ street, ward, district, province }) {
  return [street, ward, district, province].filter(Boolean).join(", ");
}
