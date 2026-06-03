export const SEPAY_BANK = import.meta.env.VITE_SEPAY_BANK || "YOUR_BANK";
export const SEPAY_ACCOUNT = import.meta.env.VITE_SEPAY_ACCOUNT || "YOUR_ACC";
export const SEPAY_ACCOUNT_NAME =
  import.meta.env.VITE_SEPAY_ACCOUNT_NAME || "READORA";

export const createSepayQrUrl = ({ amount, orderCode }) => {
  const params = new URLSearchParams({
    acc: SEPAY_ACCOUNT,
    bank: SEPAY_BANK,
    amount: String(amount),
    des: `READORA-${orderCode}`,
  });

  return `https://qr.sepay.vn/img?${params.toString()}`;
};
