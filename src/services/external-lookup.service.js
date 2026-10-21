const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const cache = new Map();

async function getJson(url) {
  const cached = cache.get(url);
  if (cached && cached.expiresAt > Date.now()) return cached.data;
  const response = await fetch(url, { headers: { Accept: "application/json", "User-Agent": "DigiMandal/1.0" }, signal: AbortSignal.timeout(8000) });
  if (!response.ok) {
    const error = new Error(`Upstream service returned ${response.status}`);
    error.status = response.status === 404 ? 404 : 502;
    throw error;
  }
  const data = await response.json();
  cache.set(url, { data, expiresAt: Date.now() + CACHE_TTL_MS });
  return data;
}

exports.lookupPincode = async (pincode) => {
  const result = await getJson(`https://api.pincodeapi.in/api/v1/pincode/${pincode}`);
  if (!result.success || !result.data?.post_offices?.length) throw { status: 404, code: "PINCODE_NOT_FOUND", message: "PIN code not found" };
  const offices = result.data.post_offices;
  return { pincode, city: offices[0].district, district: offices[0].district, state: offices[0].state, postOffices: offices.map((office) => ({ name: office.office_name, district: office.district, state: office.state, latitude: office.latitude, longitude: office.longitude, deliveryStatus: office.delivery_status })) };
};

exports.lookupIfsc = async (ifsc) => {
  try { return await getJson(`https://ifsc.razorpay.com/${ifsc}`); }
  catch (error) { if (error.status === 404) throw { status: 404, code: "IFSC_NOT_FOUND", message: "IFSC code not found" }; throw { status: 502, code: "IFSC_SERVICE_UNAVAILABLE", message: "IFSC service is temporarily unavailable" }; }
};

exports.searchBankBranches = async ({ bankcode, state, city, limit = 20, offset = 0 }) => {
  const params = new URLSearchParams({ limit: String(Math.min(Number(limit) || 20, 100)), offset: String(Math.max(Number(offset) || 0, 0)) });
  if (bankcode) params.set("bankcode", bankcode.toUpperCase());
  if (state) params.set("state", state.toUpperCase());
  if (city) params.set("city", city.toUpperCase());
  if (!bankcode && !state && !city) throw { status: 400, code: "BANK_SEARCH_FILTER_REQUIRED", message: "bankcode, state or city is required" };
  try { return await getJson(`https://ifsc.razorpay.com/search?${params}`); }
  catch (error) { throw { status: 502, code: "IFSC_SERVICE_UNAVAILABLE", message: "Bank branch service is temporarily unavailable" }; }
};
