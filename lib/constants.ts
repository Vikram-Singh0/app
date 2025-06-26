export const QueryKeys = {
  AUTH: "auth",
  GROUPS: "groups",
  FRIENDS: "friends",
  EXPENSES: "expenses",
  LEGACY_EXPENSES: "legacy-expenses",
  BALANCES: "balances",
  USER: "user",
  REMINDERS: "reminders",
  ANALYTICS: "analytics",
} as const;

// Utility function to invalidate all relevant caches after settlement
export const invalidateSettlementCaches = (queryClient: any, groupId?: string) => {
  const queriesToInvalidate: (string | string[])[] = [
    [QueryKeys.BALANCES],
    [QueryKeys.GROUPS],
    [QueryKeys.FRIENDS],
    [QueryKeys.ANALYTICS],
    [QueryKeys.EXPENSES],
  ];

  // Add specific group query if groupId is provided
  if (groupId) {
    queriesToInvalidate.push([QueryKeys.GROUPS, groupId]);
  }

  // Invalidate all queries
  queriesToInvalidate.forEach(queryKey => {
    queryClient.invalidateQueries({ queryKey });
  });

  // Force refetch critical queries
  queryClient.refetchQueries({ queryKey: [QueryKeys.BALANCES] });
  queryClient.refetchQueries({ queryKey: [QueryKeys.GROUPS] });
};
