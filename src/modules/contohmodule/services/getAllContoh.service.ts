type GetAllContohParams = {
	page?: number;
	limit?: number;
	search?: string;
};

export async function GetAllContoh(params: GetAllContohParams = {}) {
	const page = Math.max(1, Number(params.page ?? 1));
	const limit = Math.min(100, Math.max(1, Number(params.limit ?? 10)));
	const total = 0;
	const data: any[] = [];

	return {
		data,
		meta: {
			page,
			limit,
			total,
			totalPages: Math.ceil(total / limit) || 1,
		},
	};
}

