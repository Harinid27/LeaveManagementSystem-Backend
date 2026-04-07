import { User } from "../models/User.js";
import { HttpError } from "../utils/httpError.js";
import { ROLE_CREATION_MAP, ROLES } from "../utils/constants.js";

export const canCreateRole = (creatorRole, targetRole) =>
  ROLE_CREATION_MAP[creatorRole]?.includes(targetRole);

export const buildApprovalChain = async (userId) => {
  const chain = [];
  const visited = new Set();
  let cursor = await User.findById(userId).select("reportingTo");

  while (cursor?.reportingTo) {
    const approverId = cursor.reportingTo.toString();

    if (visited.has(approverId)) {
      throw new HttpError(400, "Circular reporting structure detected");
    }

    visited.add(approverId);
    const approver = await User.findById(approverId).select("_id role reportingTo name");

    if (!approver) {
      throw new HttpError(400, "Invalid reporting hierarchy");
    }

    chain.push(approver);
    cursor = approver;
  }

  return chain;
};

export const getScopedUserQuery = async (user) => {
  switch (user.role) {
    case ROLES.PRINCIPAL:
      return {};
    case ROLES.HOD: {
      // Find all professors created by/reporting to this HOD
      const professors = await User.find({ 
        reportingTo: user._id, 
        role: ROLES.PROFESSOR 
      }).select("_id");
      
      const professorIds = professors.map(p => p._id);
      
      return {
        $or: [
          { reportingTo: user._id }, // Professors under HOD
          { reportingTo: { $in: professorIds }, role: ROLES.STUDENT } // Students under those professors
        ]
      };
    }
    case ROLES.PROFESSOR:
      return { reportingTo: user._id };
    default:
      return { _id: user._id };
  }
};

export const getHODHierarchy = async (hodId) => {
  const professors = await User.find({ 
    reportingTo: hodId, 
    role: ROLES.PROFESSOR 
  }).select("_id name email department role").lean();

  const professorIds = professors.map(p => p._id);
  const students = await User.find({ 
    reportingTo: { $in: professorIds }, 
    role: ROLES.STUDENT 
  }).select("name email department role reportingTo").lean();

  return professors.map(prof => ({
    ...prof,
    students: students.filter(s => String(s.reportingTo) === String(prof._id))
  }));
};

export const getVisibleRolesForUser = (user) => {
  switch (user.role) {
    case ROLES.PRINCIPAL:
      return [ROLES.HOD, ROLES.PROFESSOR, ROLES.STUDENT, ROLES.PRINCIPAL];
    case ROLES.HOD:
      return [ROLES.HOD, ROLES.PROFESSOR, ROLES.STUDENT];
    case ROLES.PROFESSOR:
      return [ROLES.PROFESSOR, ROLES.STUDENT];
    default:
      return [ROLES.STUDENT];
  }
};

export const ensureDepartmentAccess = (creator, payloadDepartment) => {
  if (creator.role === ROLES.PRINCIPAL) {
    return;
  }

  if (creator.department !== payloadDepartment) {
    throw new HttpError(403, "You can only manage users in your department");
  }
};
