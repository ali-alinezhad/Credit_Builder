import { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { syncUserTransactions } from "../services/sync.service";

const paramsSchema = z.object({
  userId: z.string().min(1)
});

type SyncParams = {
  userId: string;
};

export async function syncController(
  request: FastifyRequest<{ Params: SyncParams }>,
  reply: FastifyReply
): Promise<void> {
  const parsedParams = paramsSchema.safeParse(request.params);
  if (!parsedParams.success) {
    reply.status(400).send({ error: parsedParams.error.flatten() });
    return;
  }

  const result = await syncUserTransactions(parsedParams.data.userId);
  reply.status(200).send(result);
}

