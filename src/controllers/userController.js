import fs from "fs";
import csv from "csv-parser";
import { User } from "../models/User.js";
import {
  getScopedUserQuery,
  getHODHierarchy
} from "../services/hierarchyService.js";
import { Leave } from "../models/Leave.js";
import { HttpError, notFound } from "../utils/httpError.js";
import { ROLES, LEAVE_STATUS } from "../utils/constants.js";
import { logActivity, getRecentActivities } from "../services/activityService.js";

export const createUser = async (req, res, next) => {
  try {
    const { name, email, password, role, department } = req.body;
    const normalizedEmail = email.toLowerCase().trim();

    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      throw new HttpError(409, "User with this email already exists");
    }

    const user = await User.create({
      name,
      email: normalizedEmail,
      password,
      role,
      department,
      createdBy: req.user._id,
      reportingTo: req.user._id,
      institutionId: req.user.institutionId
    });

    res.status(201).json({
      message: `${role} created successfully`,
      user: user.toSafeObject()
    });

    await logActivity({
      actorId: req.user._id,
      action: "user_creation",
      targetId: user._id,
      targetType: "User",
      description: `Created a new ${role}: ${user.name} (${user.email})`
    });
  } catch (error) {
    next(error);
  }
};

export const getUsers = async (req, res, next) => {
  try {
    const { role } = req.query;
    const filters = await getScopedUserQuery(req.user);
    const roleFilter = role ? { role } : {};
    
    // Debug point: check what's being queried
    console.log(`[getUsers] Fetching users for ${req.user.email} (${req.user.role}). Filters:`, { ...filters, ...roleFilter });

    const users = await User.find({ ...filters, ...roleFilter })
      .populate("reportingTo", "name role email")
      .populate("createdBy", "name role email")
      .sort({ createdAt: -1 })
      .lean();

    console.log(`[getUsers] Found ${users.length} users`);

    // Enhancers for HOD or Principal view to include student counts
    const enhancedUsers = await Promise.all(users.map(async (u) => {
      const studentCount = await User.countDocuments({ 
        reportingTo: u._id, 
        role: ROLES.STUDENT 
      });
      return { ...u, id: u._id, studentCount }; // Ensure id is available
    }));

    res.json({
      users: enhancedUsers,
      visibleTo: req.user.role
    });
  } catch (error) {
    next(error);
  }
};

export const getUserById = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id)
      .populate("reportingTo", "name role email")
      .populate("createdBy", "name role email");

    if (!user) {
      notFound("User not found");
    }

    const scopedQuery = await getScopedUserQuery(req.user);
    const hasAccess =
      req.user.role === ROLES.PRINCIPAL ||
      (scopedQuery.department && scopedQuery.department === user.department) ||
      (scopedQuery.reportingTo && `${scopedQuery.reportingTo}` === `${user.reportingTo}`) ||
      `${req.user._id}` === `${user._id}`;

    if (!hasAccess) {
      throw new HttpError(403, "You are not allowed to view this user");
    }

    res.json({ user: user.toSafeObject() });
  } catch (error) {
    next(error);
  }
};

export const getProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id)
      .populate("reportingTo", "name role email department")
      .populate("createdBy", "name role email department");

    if (!user) {
      notFound("User not found");
    }

    res.json({ user: user.toSafeObject() });
  } catch (error) {
    next(error);
  }
};

export const getSummary = async (req, res, next) => {
  try {
    if (req.user.role === ROLES.PRINCIPAL) {
      const counts = await User.aggregate([
        { $match: { institutionId: req.user.institutionId } },
        {
          $group: {
            _id: "$role",
            count: { $sum: 1 }
          }
        }
      ]);

      const summary = {
        hod: 0,
        professor: 0,
        student: 0
      };

      counts.forEach((item) => {
        if (summary.hasOwnProperty(item._id)) {
          summary[item._id] = item.count;
        }
      });

      res.json({ summary });
    } else if (req.user.role === ROLES.HOD) {
      const professors = await User.find({ reportingTo: req.user._id, role: ROLES.PROFESSOR }).select("_id");
      const professorIds = professors.map(p => p._id);
      
      const [studentCount, pendingLeaves] = await Promise.all([
        User.countDocuments({ reportingTo: { $in: professorIds }, role: ROLES.STUDENT }),
        Leave.countDocuments({ currentApprover: req.user._id, status: "pending" })
      ]);

      res.json({
        summary: {
          professor: professors.length,
          student: studentCount,
          pendingLeaves
        }
      });
    } else if (req.user.role === ROLES.PROFESSOR) {
      const [studentCount, pendingLeaves, approvedLeaves, rejectedLeaves] = await Promise.all([
        User.countDocuments({ reportingTo: req.user._id, role: ROLES.STUDENT }),
        Leave.countDocuments({ currentApprover: req.user._id, status: LEAVE_STATUS.PENDING }),
        Leave.countDocuments({ 
          userId: { $in: await User.find({ reportingTo: req.user._id, role: ROLES.STUDENT }).distinct("_id") }, 
          status: LEAVE_STATUS.APPROVED 
        }),
        Leave.countDocuments({ 
          userId: { $in: await User.find({ reportingTo: req.user._id, role: ROLES.STUDENT }).distinct("_id") }, 
          status: LEAVE_STATUS.REJECTED 
        })
      ]);

      res.json({
        summary: {
          student: studentCount,
          pendingLeaves,
          approvedLeaves,
          rejectedLeaves
        }
      });
    } else {
      throw new HttpError(403, "You do not have permission to access summary statistics");
    }
  } catch (error) {
    next(error);
  }
};

export const deleteUser = async (req, res, next) => {
  try {
    const userToDelete = await User.findById(req.params.id);
    if (!userToDelete) {
      notFound("User not found");
    }

    // Role-based protection
    if (req.user.role === ROLES.PRINCIPAL) {
      // Principal can delete anyone
    } else if (req.user.role === ROLES.HOD) {
      if (String(userToDelete.reportingTo) !== String(req.user._id)) {
        throw new HttpError(403, "You can only delete staff members who report to you");
      }
    } else {
      throw new HttpError(403, "You don't have permission to delete users");
    }

    await User.findByIdAndDelete(req.params.id);
    res.json({ message: "User deleted successfully" });

    await logActivity({
      actorId: req.user._id,
      action: "user_deletion",
      targetId: userToDelete._id,
      targetType: "User",
      description: `Deleted ${userToDelete.role}: ${userToDelete.name} (${userToDelete.email})`
    });
  } catch (error) {
    next(error);
  }
};

export const getHierarchy = async (req, res, next) => {
  try {
    if (req.user.role === ROLES.PRINCIPAL) {
      const users = await User.find({ institutionId: req.user.institutionId })
        .select("name role email department reportingTo").lean();

      const buildTree = (parentId = null) => {
        return users
          .filter((user) => String(user.reportingTo) === String(parentId))
          .map((user) => ({
            ...user,
            children: buildTree(user._id)
          }));
      };

      const principal = users.find((u) => u.role === ROLES.PRINCIPAL);
      const hierarchy = principal ? { ...principal, children: buildTree(principal._id) } : null;

      res.json({ hierarchy });
    } else if (req.user.role === ROLES.HOD) {
      const hierarchy = await getHODHierarchy(req.user._id);
      res.json({ hierarchy });
    } else {
      throw new HttpError(403, "You don't have permission to access hierarchy");
    }
  } catch (error) {
    next(error);
  }
};

export const getActivities = async (req, res, next) => {
  try {
    let filter = {};
    
    if (req.user.role === ROLES.HOD) {
      filter = { actorId: req.user._id };
    } else if (req.user.role !== ROLES.PRINCIPAL) {
      throw new HttpError(403, "You do not have permission to view activity logs");
    }

    const activities = await getRecentActivities(filter, 15);
    res.json({ activities });
  } catch (error) {
    next(error);
  }
};

export const updateProfile = async (req, res, next) => {
  try {
    const { name, currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user._id);

    if (!user) {
      notFound("User not found");
    }

    if (name) user.name = name;

    // Password update logic
    if (newPassword) {
      if (!currentPassword) {
        throw new HttpError(400, "Current password is required to set a new password");
      }
      
      const isMatch = await user.comparePassword(currentPassword);
      if (!isMatch) {
        throw new HttpError(401, "Invalid current password");
      }
      
      user.password = newPassword;
    }

    await user.save();

    await logActivity({
      actorId: req.user._id,
      action: "profile_update",
      targetId: user._id,
      targetType: "User",
      description: `${user.name} updated their profile details${newPassword ? " including password" : ""}.`
    });

    res.json({
      message: "Profile updated successfully",
      user: user.toSafeObject()
    });
  } catch (error) {
    next(error);
  }
};

export const updateUserAsAdmin = async (req, res, next) => {
  try {
    const { name, email, department } = req.body;
    const userToUpdate = await User.findById(req.params.id);

    if (!userToUpdate) {
      notFound("User not found");
    }

    const isPrincipal = req.user.role === ROLES.PRINCIPAL;
    const isDirectHOD = req.user.role === ROLES.HOD && String(userToUpdate.reportingTo) === String(req.user._id);

    if (!isPrincipal && !isDirectHOD) {
      throw new HttpError(403, "You do not have permission to edit this user's details");
    }

    if (name) userToUpdate.name = name;
    if (email) userToUpdate.email = email.toLowerCase().trim();
    if (department && isPrincipal) userToUpdate.department = department;

    await userToUpdate.save();

    await logActivity({
      actorId: req.user._id,
      action: "user_update",
      targetId: userToUpdate._id,
      targetType: "User",
      description: `Updated details for ${userToUpdate.role}: ${userToUpdate.name}`
    });

    res.json({
      message: "User updated successfully",
      user: userToUpdate.toSafeObject()
    });
  } catch (error) {
    next(error);
  }
};

export const getAllUsers = async (req, res, next) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      search = "", 
      role = "", 
      department = "", 
      sortBy = "createdAt", 
      sortOrder = "desc" 
    } = req.query;

    const query = { 
      _id: { $ne: req.user._id },
      institutionId: req.user.institutionId
    };

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } }
      ];
    }

    if (role) query.role = role;
    if (department) query.department = { $regex: department, $options: "i" };

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sortOptions = { [sortBy]: sortOrder === "desc" ? -1 : 1 };

    const [users, total] = await Promise.all([
      User.find(query)
        .populate("reportingTo", "name role email")
        .sort(sortOptions)
        .skip(skip)
        .limit(parseInt(limit)),
      User.countDocuments(query)
    ]);

    res.json({
      users: users.map(u => u.toSafeObject()),
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        limit: parseInt(limit)
      }
    });

  } catch (error) {
    next(error);
  }
};

export const bulkImportUsers = async (req, res, next) => {
  const results = [];
  const errors = [];
  const filePath = req.file?.path;

  if (!filePath) {
    return next(new HttpError(400, "No file uploaded"));
  }

  try {
    const parseCSV = () => new Promise((resolve, reject) => {
      fs.createReadStream(filePath)
        .pipe(csv())
        .on("data", (data) => results.push(data))
        .on("end", resolve)
        .on("error", reject);
    });

    await parseCSV();

    const summary = {
      total: results.length,
      success: 0,
      failed: 0,
      details: []
    };

    const defaultPassword = "Welcome@123";

    for (const row of results) {
      try {
        const { name, email, role, department, reportingToEmail } = row;
        
        if (!name || !email || !role || !department) {
          throw new Error("Missing required fields (name, email, role, department)");
        }

        const normalizedEmail = email.toLowerCase().trim();
        const existingUser = await User.findOne({ email: normalizedEmail });
        if (existingUser) {
          throw new Error(`User with email ${normalizedEmail} already exists`);
        }

        let reportingTo = null;
        if (reportingToEmail) {
          const supervisor = await User.findOne({ email: reportingToEmail.toLowerCase().trim() });
          if (supervisor) {
            reportingTo = supervisor._id;
          }
        }

        const newUser = await User.create({
          name,
          email: normalizedEmail,
          password: defaultPassword,
          role: role.toLowerCase().trim(),
          department,
          reportingTo,
          createdBy: req.user._id,
          institutionId: req.user.institutionId
        });

        summary.success++;
        summary.details.push({ email: normalizedEmail, status: "success" });
      } catch (err) {
        summary.failed++;
        summary.details.push({ 
          email: row.email || "Unknown", 
          status: "failed", 
          error: err.message 
        });
      }
    }

    // Clean up file
    fs.unlinkSync(filePath);

    await logActivity({
      actorId: req.user._id,
      action: "bulk_import",
      targetType: "User",
      description: `Bulk imported ${summary.success} users. ${summary.failed} failed.`,
      metadata: summary
    });

    res.json({
      message: `Import completed. Successful: ${summary.success}, Failed: ${summary.failed}`,
      summary
    });

  } catch (error) {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    next(error);
  }
};
