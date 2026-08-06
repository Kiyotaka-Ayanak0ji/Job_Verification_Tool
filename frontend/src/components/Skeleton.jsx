import { motion } from "framer-motion";

export const SkeletonText = ({ className = "" } = {}) => (
  <motion.div
    className={`h-4 w-32 rounded bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 bg-[length:200%_100%] animate-shimmer ${className}`}
    initial={{ opacity: 0 }}
    animate={{ opacity: [0, 1, 1] }}
    transition={{ duration: 0.5 }}
  />
);

export const SkeletonAvatar = () => (
  <motion.div
    className="h-10 w-10 rounded-full bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 bg-[length:200%_100%] animate-shimmer"
    initial={{ opacity: 0 }}
    animate={{ opacity: [0, 1, 1] }}
    transition={{ duration: 0.5 }}
  />
);

export const SkeletonAvatarText = () => (
  <div className="flex items-center space-x-3">
    <SkeletonAvatar />
    <div className="space-y-1">
      <SkeletonText className="w-32" />
      <SkeletonText className="w-24" />
    </div>
  </div>
);

export const SkeletonButton = ({ size = "p-2 px-4", className = "" } = {}) => (
  <motion.button
    className={`${size} rounded bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 bg-[length:200%_100%] animate-shimmer ${className}`}
    disabled
    initial={{ opacity: 0 }}
    animate={{ opacity: [0, 1, 1] }}
    transition={{ duration: 0.5 }}
  />
);

export const SkeletonInput = ({ className = "" } = {}) => (
  <motion.input
    className={`block w-full rounded border bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 bg-[length:200%_100%] animate-shimmer ${className}`}
    readOnly
    initial={{ opacity: 0 }}
    animate={{ opacity: [0, 1, 1] }}
    transition={{ duration: 0.5 }}
  />
);

export const SkeletonCard = ({ children, className = "" } = {}) => (
  <motion.div
    className={`p-6 rounded bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 bg-[length:200%_100%] animate-shimmer ${className}`}
    initial={{ opacity: 0 }}
    animate={{ opacity: [0, 1, 1] }}
    transition={{ duration: 0.5 }}
  >
    {children}
  </motion.div>
);

export const SkeletonTableRow = () => (
  <motion.tr
    className="hover:bg-border/10"
    initial={{ opacity: 0 }}
    animate={{ opacity: [0, 1, 1] }}
    transition={{ duration: 0.5 }}
  >
    <td className="p-3">
      <SkeletonText className="w-32" />
    </td>
    <td className="p-3">
      <span className={`px-2 py-0.5 rounded-md border text-xs`}>
        <SkeletonText className="w-16 h-4" />
        <SkeletonText className="w-20 h-4 ml-2" />
      </span>
    </td>
    <td className="p-3">
      <SkeletonText className="w-24" />
    </td>
    <td className="p-3 text-muted text-xs">
      <SkeletonText className="w-24" />
    </td>
    <td className="p-3 text-right">
      <SkeletonButton size="p-1 px-2" />
    </td>
  </motion.tr>
);

export const SkeletonListItem = () => (
  <motion.li
    className="card p-4 flex items-center justify-between hover:border-accent/50 transition-colors"
    initial={{ opacity: 0 }}
    animate={{ opacity: [0, 1, 1] }}
    transition={{ duration: 0.5 }}
  >
    <div>
      <SkeletonText className="w-32" />
      <SkeletonText className="w-24 text-xs text-muted mt-1" />
    </div>
    <span className={`px-2 py-0.5 rounded-md border text-xs`}>
      <SkeletonText className="w-20 h-4" />
    </span>
  </motion.li>
);

export const SkeletonProfileSection = () => (
  <motion.div
    className="max-w-3xl mx-auto px-6 py-10 space-y-6"
    initial={{ opacity: 0 }}
    animate={{ opacity: [0, 1, 1] }}
    transition={{ duration: 0.5 }}
  >
    {/* Profile Header */}
    <motion.div
      className="card p-6 flex items-start justify-between"
      initial={{ opacity: 0 }}
      animate={{ opacity: [0, 1, 1] }}
      transition={{ duration: 0.5 }}
    >
      <div>
        <SkeletonText className="w-24" />
        <SkeletonText className="w-32 mt-1" />
        <SkeletonText className="w-20 text-sm text-muted mt-1" />
      </div>
      <div className="text-right">
        <SkeletonButton size="p-2 px-4" />
      </div>
    </motion.div>

    {/* Stats Cards */}
    <motion.div
      className="grid md:grid-cols-3 gap-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: [0, 1, 1] }}
      transition={{ duration: 0.5 }}
    >
      {[1, 2, 3].map((i) => (
        <motion.div
          key={i}
          className="card p-6 text-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 1, 1] }}
          transition={{ duration: 0.5 }}
        >
          <SkeletonText className="w-16 h-16 mx-auto mb-3 rounded-full" />
          <SkeletonText className="w-24" />
          <SkeletonText className="w-20 text-sm text-muted mt-2" />
        </motion.div>
      ))}
    </motion.div>

    {/* Recent Activity */}
    <motion.div
      className="card p-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: [0, 1, 1] }}
      transition={{ duration: 0.5 }}
    >
      <h2 className="font-semibold mb-4">Recent Activity</h2>
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <motion.div
            key={i}
            className="flex items-start space-x-3"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 1] }}
            transition={{ duration: 0.5 }}
          >
            <SkeletonAvatar />
            <div className="space-y-1">
              <SkeletonText className="w-32" />
              <SkeletonText className="w-40 text-sm text-muted" />
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  </motion.div>
);