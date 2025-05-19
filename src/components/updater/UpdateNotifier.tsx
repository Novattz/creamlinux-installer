import { useUpdateChecker } from '@/hooks/useUpdateChecker'

/**
 * Simple component that uses the update checker hook
 * Can be dropped in anywhere in the app
 */
const UpdateNotifier = () => {
  useUpdateChecker()
  
  // This component doesn't render anything
  return null
}

export default UpdateNotifier