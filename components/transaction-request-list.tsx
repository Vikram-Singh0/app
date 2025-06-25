import { ReminderResponse } from "@/features/reminders/api/client";
import { Check, X, Loader2 } from "lucide-react";
import Image from "next/image";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface TransactionRequestListProps {
  reminders: ReminderResponse[];
  onAccept?: (reminderId: string) => void;
  onReject?: (reminderId: string) => void;
  isAccepting?: boolean;
  isRejecting?: boolean;
  className?: string;
}

function getTimeAgo(date: string) {
  const now = new Date();
  const reminderDate = new Date(date);
  const diffInSeconds = Math.floor((now.getTime() - reminderDate.getTime()) / 1000);

  if (diffInSeconds < 60) {
    return 'just now';
  }

  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return `${diffInMinutes} minute${diffInMinutes === 1 ? '' : 's'} ago`;
  }

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return `${diffInHours} hour${diffInHours === 1 ? '' : 's'} ago`;
  }

  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 30) {
    return `${diffInDays} day${diffInDays === 1 ? '' : 's'} ago`;
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
  }).format(reminderDate);
}

export function TransactionRequestList({ 
  reminders, 
  onAccept, 
  onReject, 
  isAccepting,
  isRejecting,
  className = "" 
}: TransactionRequestListProps) {
  if (!reminders || reminders.length === 0) {
    return (
      <div className="text-center py-8 text-white/60">
        No transaction requests yet
      </div>
    );
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {reminders.map((reminder) => {
        // Get amount from split if available, otherwise try to get from content or balances
        const amount = reminder.split?.amount || reminder.amount || 0;
        let requestText = "Request pending";
        if (reminder.split) {
          requestText = `Requested $${amount.toFixed(2)}`;
        } else if (reminder.reminderType === "USER") {
          if (amount > 0) {
            requestText = `Requested $${amount.toFixed(2)}`;
          } else if (reminder.content) {
            requestText = reminder.content;
          } else {
            requestText = "Requested payment";
          }
        }

        return (
          <div
            key={reminder.id}
            className="flex items-center justify-between p-3 sm:p-4 rounded-xl bg-[#101012] border border-white/10"
          >
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
                    <div className="h-10 w-10 sm:h-12 sm:w-12 flex-shrink-0 overflow-hidden rounded-xl bg-white/[0.03]">
                      <Image
                        src={`https://api.dicebear.com/9.x/identicon/svg?seed=${reminder.senderId}`}
                        alt={reminder.sender.name}
                        width={48}
                        height={48}
                        className="h-full w-full"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-mobile-base sm:text-base text-white font-medium whitespace-nowrap">
                        {reminder.sender.name} is Requesting
                      </p>
                      <p className="text-mobile-sm sm:text-base text-white/60">
                        {reminder.reminderType === "USER"
                          ? (reminder.amount && reminder.amount > 0
                              ? `$${reminder.amount.toFixed(2)}`
                              : reminder.content || "Requested payment")
                          : reminder.split && reminder.split.expenseParticipants && reminder.split.expenseParticipants.length > 0
                            ? `$${reminder.split.expenseParticipants[0].amount.toFixed(2)}`
                            : reminder.split
                              ? `$${reminder.split.amount.toFixed(2)}`
                              : "$0.00"}
                      </p>
                      <p className="text-xs sm:text-sm text-white/60">
                        {getTimeAgo(reminder.createdAt)}
                      </p>
                    </div>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <div className="space-y-1">
                    <p>Type: {reminder.reminderType}</p>
                    {reminder.splitId && <p>Split ID: {reminder.splitId}</p>}
                    <p>Status: {reminder.status}</p>
                    <p>Created: {new Date(reminder.createdAt).toLocaleString()}</p>
                    {reminder.split && (
                      <p>Amount: ${reminder.split.amount.toFixed(2)}</p>
                    )}
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <div className="flex items-center gap-2 ml-3 sm:ml-4 flex-shrink-0">
              {onAccept && (
                <button
                  onClick={() => onAccept(reminder.id)}
                  disabled={isAccepting || isRejecting}
                  className="p-1.5 sm:p-2 rounded-full hover:bg-white/5 text-green-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isAccepting ? (
                    <Loader2 className="h-4 w-4 sm:h-5 sm:w-5 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4 sm:h-5 sm:w-5" />
                  )}
                </button>
              )}
              {onReject && (
                <button
                  onClick={() => onReject(reminder.id)}
                  disabled={isAccepting || isRejecting}
                  className="p-1.5 sm:p-2 rounded-full hover:bg-white/5 text-red-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isRejecting ? (
                    <Loader2 className="h-4 w-4 sm:h-5 sm:w-5 animate-spin" />
                  ) : (
                    <X className="h-4 w-4 sm:h-5 sm:w-5" />
                  )}
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
} 