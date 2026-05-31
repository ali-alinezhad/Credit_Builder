import { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { buildReliabilityIndex } from "../services/reliability.service";

const paramsSchema = z.object({
  userId: z.string().min(1)
});

const querySchema = z.object({
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected from=YYYY-MM-DD")
    .refine((value) => {
      const parsed = new Date(`${value}T00:00:00.000Z`);
      return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
    }, "Invalid calendar date")
});

type ReliabilityParams = {
  userId: string;
};

type ReliabilityQuery = {
  from: string;
};

export async function reliabilityController(
  request: FastifyRequest<{ Params: ReliabilityParams; Querystring: ReliabilityQuery }>,
  reply: FastifyReply
): Promise<void> {
  const parsedParams = paramsSchema.safeParse(request.params);
  const parsedQuery = querySchema.safeParse(request.query);

  if (!parsedParams.success || !parsedQuery.success) {
    reply.status(400).send({
      error: {
        params: parsedParams.success ? null : parsedParams.error.flatten(),
        query: parsedQuery.success ? null : parsedQuery.error.flatten()
      }
    });
    return;
  }

  const result = await buildReliabilityIndex(parsedParams.data.userId, parsedQuery.data.from);
  reply.status(200).send(result);
}

