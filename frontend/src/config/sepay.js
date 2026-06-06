export const SEPAY_BANK = import.meta.env.VITE_SEPAY_BANK || "MBBank";
export const SEPAY_ACCOUNT = import.meta.env.VITE_SEPAY_ACCOUNT || "VQRQAJLQW8756";
export const SEPAY_ACCOUNT_NAME =
  import.meta.env.VITE_SEPAY_ACCOUNT_NAME || "HO CHI DUNG";

export const createSepayQrUrl = ({ amount, orderCode }) => {
  const params = new URLSearchParams({
    acc: SEPAY_ACCOUNT,
    bank: SEPAY_BANK,
    amount: String(amount),
    des: `READORA-${orderCode}`,
  });

  return `https://qr.sepay.vn/img?${params.toString()}`;
};