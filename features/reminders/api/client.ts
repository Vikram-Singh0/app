import { apiClient } from "@/api-helpers/client";
import { z } from "zod";

// Schema for reminder request
const reminderRequestSchema = z.object({
  receiverId: z.string(),
  reminderType: z.enum(["USER", "SPLIT"]),
  splitId: z.string().optional(),
  content: z.string().optional(),
}).refine((data) => {
  // Make splitId required when reminderType is SPLIT
  if (data.reminderType === "SPLIT" && !data.splitId) {
    return false;
  }
  return true;
}, {
  message: "splitId is required when reminderType is SPLIT",
});

// Schema for reminder response
const reminderResponseSchema = z.object({
  id: z.string(),
  senderId: z.string(),
  receiverId: z.string(),
  reminderType: z.string(),
  splitId: z.string().nullable().optional(),
  content: z.string().nullable(),
  status: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  sender: z.object({
    id: z.string(),
    name: z.string(),
  }),
  split: z.object({
    id: z.string(),
    amount: z.number(),
    name: z.string().optional(),
    paidByUser: z.object({
      id: z.string(),
      name: z.string(),
    }).optional(),
    expenseParticipants: z.array(z.object({
      amount: z.number(),
    })).optional(),
  }).nullable().optional(),
  amount: z.number().optional(),
});

export type ReminderRequest = z.infer<typeof reminderRequestSchema>;
export type ReminderResponse = z.infer<typeof reminderResponseSchema>;

// Send a reminder
export const sendReminder = async (data: ReminderRequest): Promise<ReminderResponse> => {
  const response = await apiClient.post("/reminders", data);
  return reminderResponseSchema.parse(response);
};

// Get reminders for the current user
export const getReminders = async (): Promise<ReminderResponse[]> => {
  const response = await apiClient.get("/reminders");
  return z.array(reminderResponseSchema).parse(response);
};

// Accept a reminder
export const acceptReminder = async (reminderId: string): Promise<ReminderResponse> => {
  const response = await apiClient.post(`/reminders/${reminderId}/accept`);
  return reminderResponseSchema.parse(response);
};

// Reject a reminder
export const rejectReminder = async (reminderId: string): Promise<ReminderResponse> => {
  const response = await apiClient.post(`/reminders/${reminderId}/reject`);
  return reminderResponseSchema.parse(response);
};