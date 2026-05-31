import { FastifyReply, FastifyRequest } from "fastify";

export async function healthController(_request: FastifyRequest, reply: FastifyReply): Promise<void> {
  reply.status(200).send({ status: "ok" });
}

