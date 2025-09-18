export const yamlSchema = {
	type: "object",
	properties: {
		agents: {
			type: "array",
			items: {
				type: "object",
				properties: {
					name: { type: "string", minLength: 1 },
					description: { type: "string", minLength: 1 },
					entry: { type: "string", minLength: 1 },
					type: {
						type: "string",
						enum: ["REGULAR", "CHATBOT", "WORKFLOW"],
					},
					inputSchema: {
						type: "object",
						properties: {
							type: { type: "string", const: "object" },
							properties: {
								type: "object",
								additionalProperties: {
									type: "object",
									properties: {
										type: { type: "string", minLength: 1 },
										description: { type: "string" },
										default: {
											type: [
												"string",
												"number",
												"boolean",
												"null",
											],
										},
									},
									required: ["type"],
									additionalProperties: true,
								},
							},
							required: {
								type: "array",
								items: { type: "string", minLength: 1 },
								uniqueItems: true,
							},
						},
						required: ["type", "properties"],
						additionalProperties: true,
					},
				},
				required: ["name", "description", "entry", "inputSchema"],
				additionalProperties: true,
			},
		},
	},
	required: ["agents"],
	additionalProperties: true,
} as const;
