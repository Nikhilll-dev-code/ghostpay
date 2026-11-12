import { ActionProposal, APPROVAL_STATUSES, Approval } from "@ghost/shared";
import { prisma } from "../../repositories/prisma.js";
import { hashProposalPayload } from "../policy/policyEngine.js";

export class ApprovalService {
  public static async createApproval(
    decisionId: string,
    proposal: ActionProposal,
    requestedBy: string,
    expiresInMinutes: number = 30
  ): Promise<Approval> {
    const payloadHash = hashProposalPayload(proposal);
    const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000);

    const record = await prisma.approval.create({
      data: {
        decisionId,
        payloadHash,
        status: APPROVAL_STATUSES.PENDING,
        requestedBy,
        expiresAt,
      },
    });

    return {
      id: record.id,
      decisionId: record.decisionId,
      payloadHash: record.payloadHash,
      status: record.status as any,
      requestedBy: record.requestedBy,
      decidedBy: record.decidedBy,
      expiresAt: record.expiresAt.toISOString(),
      decidedAt: record.decidedAt ? record.decidedAt.toISOString() : null,
      createdAt: record.createdAt.toISOString(),
    };
  }

  public static async approveApproval(approvalId: string, decidedBy: string): Promise<Approval> {
    const approval = await prisma.approval.findUnique({ where: { id: approvalId } });
    if (!approval) {
      throw new Error("Approval record not found");
    }
    if (approval.status !== APPROVAL_STATUSES.PENDING) {
      throw new Error(`Cannot approve item in status ${approval.status}`);
    }
    if (approval.expiresAt.getTime() < Date.now()) {
      await prisma.approval.update({
        where: { id: approvalId },
        data: { status: APPROVAL_STATUSES.EXPIRED },
      });
      throw new Error("Approval has expired");
    }

    const updated = await prisma.approval.update({
      where: { id: approvalId },
      data: {
        status: APPROVAL_STATUSES.APPROVED,
        decidedBy,
        decidedAt: new Date(),
      },
    });

    return {
      id: updated.id,
      decisionId: updated.decisionId,
      payloadHash: updated.payloadHash,
      status: updated.status as any,
      requestedBy: updated.requestedBy,
      decidedBy: updated.decidedBy,
      expiresAt: updated.expiresAt.toISOString(),
      decidedAt: updated.decidedAt ? updated.decidedAt.toISOString() : null,
      createdAt: updated.createdAt.toISOString(),
    };
  }

  public static async rejectApproval(approvalId: string, decidedBy: string): Promise<Approval> {
    const updated = await prisma.approval.update({
      where: { id: approvalId },
      data: {
        status: APPROVAL_STATUSES.REJECTED,
        decidedBy,
        decidedAt: new Date(),
      },
    });

    return {
      id: updated.id,
      decisionId: updated.decisionId,
      payloadHash: updated.payloadHash,
      status: updated.status as any,
      requestedBy: updated.requestedBy,
      decidedBy: updated.decidedBy,
      expiresAt: updated.expiresAt.toISOString(),
      decidedAt: updated.decidedAt ? updated.decidedAt.toISOString() : null,
      createdAt: updated.createdAt.toISOString(),
    };
  }

  public static async markUsed(approvalId: string): Promise<Approval> {
    const updated = await prisma.approval.update({
      where: { id: approvalId },
      data: {
        status: APPROVAL_STATUSES.USED,
      },
    });

    return {
      id: updated.id,
      decisionId: updated.decisionId,
      payloadHash: updated.payloadHash,
      status: updated.status as any,
      requestedBy: updated.requestedBy,
      decidedBy: updated.decidedBy,
      expiresAt: updated.expiresAt.toISOString(),
      decidedAt: updated.decidedAt ? updated.decidedAt.toISOString() : null,
      createdAt: updated.createdAt.toISOString(),
    };
  }
}
