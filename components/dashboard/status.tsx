import type { OrderPaymentStatus, OrderStatus, PaymentStatus } from "@prisma/client";
import { Badge } from "@/components/ui";

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING: "Pending", PAID: "Paid", PROCESSING: "Processing", READY_FOR_DELIVERY: "Ready for delivery",
  SHIPPED: "Shipped", DELIVERED: "Delivered", CANCELLED: "Cancelled",
};
const ORDER_COLOR: Record<OrderStatus, "gray" | "green" | "yellow" | "red" | "blue" | "purple"> = {
  PENDING: "yellow", PAID: "green", PROCESSING: "blue", READY_FOR_DELIVERY: "purple", SHIPPED: "blue", DELIVERED: "green", CANCELLED: "red",
};
export const OrderStatusBadge = ({ status }: { status: OrderStatus }) => <Badge color={ORDER_COLOR[status]}>{ORDER_STATUS_LABEL[status]}</Badge>;

export const OrderPaymentBadge = ({ status }: { status: OrderPaymentStatus }) => (
  <Badge color={status === "PAID" ? "green" : status === "REFUNDED" ? "purple" : "gray"}>{status === "PAID" ? "Paid" : status === "REFUNDED" ? "Refunded" : "Unpaid"}</Badge>
);

const PAY_COLOR: Record<PaymentStatus, "gray" | "green" | "yellow" | "red" | "blue" | "purple"> = {
  pending: "gray", processing: "yellow", successful: "green", failed: "red", expired: "red", cancelled: "red", refunded: "purple",
};
export const PaymentStatusBadge = ({ status }: { status: PaymentStatus }) => <Badge color={PAY_COLOR[status]}>{status}</Badge>;
