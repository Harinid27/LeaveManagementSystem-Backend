export const ROLES = {
  PRINCIPAL: "principal",
  HOD: "hod",
  PROFESSOR: "professor",
  STUDENT: "student"
};

export const ROLE_LABELS = Object.values(ROLES);

export const ROLE_CREATION_MAP = {
  [ROLES.PRINCIPAL]: [ROLES.HOD],
  [ROLES.HOD]: [ROLES.PROFESSOR],
  [ROLES.PROFESSOR]: [ROLES.STUDENT],
  [ROLES.STUDENT]: []
};

export const LEAVE_STATUS = {
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected"
};

export const APPROVAL_ACTION = {
  APPROVED: "approved",
  REJECTED: "rejected",
  PENDING: "pending"
};
