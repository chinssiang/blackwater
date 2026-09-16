'use client';

import { QueryClientProvider, QueryClient } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';

const ReactQueryProvider = ({ children }: { children: ReactNode }) => {
	const [queryClient] = useState(() => new QueryClient());

	return (
		<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
	);
};

export default ReactQueryProvider;
