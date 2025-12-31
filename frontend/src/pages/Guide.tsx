import { useAuth } from '../contexts/AuthContext';
import { IconClipboard, IconVideo, IconEdit, IconCurrencyDollar } from '@tabler/icons-react';

export default function Guide() {
  const { user } = useAuth();
  const isAdmin = user?.roles?.includes('admin') || user?.role === 'admin';
  const isClipper = user?.roles?.includes('clipper') || user?.role === 'clipper';
  const isEditor = user?.roles?.includes('editor') || user?.role === 'editor';

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-neutral-900 mb-2">User Guide</h1>
          <p className="text-neutral-600">
            Everything you need to know about using the Video Pipeline App
          </p>
        </div>

        <div className="space-y-8">
          {/* Overview Section */}
          <section className="bg-white rounded-xl border border-neutral-200 shadow-sm p-6">
            <h2 className="text-2xl font-semibold text-neutral-900 mb-4">Overview</h2>
            <p className="text-neutral-700 mb-4">
              The Video Pipeline App helps manage the production workflow for YouTube Shorts. 
              Each video goes through several stages: Idea → Script → Clips → Editing → Ready to Upload.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div className="p-4 bg-neutral-50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <IconClipboard className="h-5 w-5 text-blue-600" />
                  <h3 className="font-semibold text-neutral-900">Dashboard</h3>
                </div>
                <p className="text-sm text-neutral-600">
                  View all shorts organized by stage. Drag and drop to move shorts between stages.
                </p>
              </div>
              <div className="p-4 bg-neutral-50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <IconCurrencyDollar className="h-5 w-5 text-green-600" />
                  <h3 className="font-semibold text-neutral-900">Payments</h3>
                </div>
                <p className="text-sm text-neutral-600">
                  Track your earnings, view payment history, and see your current rates.
                </p>
              </div>
            </div>
          </section>

          {/* Clippers Section */}
          {(isClipper || isAdmin) && (
            <section className="bg-white rounded-xl border border-neutral-200 shadow-sm p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
                  <IconVideo className="h-6 w-6 text-orange-600" />
                </div>
                <h2 className="text-2xl font-semibold text-neutral-900">For Clippers</h2>
              </div>
              
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold text-neutral-900 mb-2">Finding Your Assignments</h3>
                  <p className="text-neutral-700 mb-2">
                    You'll typically know in advance which shorts are assigned to you from communication in Discord. 
                    Once assigned, you can view the shorts assigned to you in the <strong>"Clips"</strong> column on the Dashboard.
                  </p>
                  <p className="text-neutral-700">
                    If a set of clips needs revisions, it will appear in the <strong>"Clip Changes"</strong> column for you to review and update.
                  </p>
                </div>

                <div>
                  <h3 className="font-semibold text-neutral-900 mb-2">Your Workflow</h3>
                  <ol className="list-decimal list-inside space-y-2 text-neutral-700">
                    <li>Click on a short card in the "Clips" column to view details</li>
                    <li>Download the Script PDF and Audio MP3 from the short detail page</li>
                    <li>Create clips according to the script</li>
                    <li>Upload your clips as a ZIP file using the "Upload Clips ZIP" button</li>
                    <li>Once uploaded, the short will move to "Clip Changes" for review</li>
                  </ol>
                </div>

                <div>
                  <h3 className="font-semibold text-neutral-900 mb-2">Payment Tracking</h3>
                  <p className="text-neutral-700">
                    When your clips are reviewed and marked as complete, the payment will be automatically tracked in the <strong>Payments</strong> view. 
                    You can check the Payments section at any time to see what you're owed and your payment history.
                  </p>
                </div>

                <div className="p-4 bg-orange-50 border-2 border-orange-300 rounded-lg">
                  <p className="text-sm text-orange-900 font-semibold mb-1">
                    ⚠️ Important: Flashback Reference Guide
                  </p>
                  <p className="text-sm text-orange-800">
                    The <strong>Flashback Reference</strong> (available in the sidebar) contains the complete guide on how clips should be styled and formatted. 
                    This is your primary reference document - make sure to check it regularly when creating clips!
                  </p>
                </div>
              </div>
            </section>
          )}

          {/* Editors Section */}
          {(isEditor || isAdmin) && (
            <section className="bg-white rounded-xl border border-neutral-200 shadow-sm p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                  <IconEdit className="h-6 w-6 text-green-600" />
                </div>
                <h2 className="text-2xl font-semibold text-neutral-900">For Editors</h2>
              </div>
              
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold text-neutral-900 mb-2">Finding Your Assignments</h3>
                  <p className="text-neutral-700 mb-2">
                    You'll typically know in advance which shorts are assigned to you from communication in Discord. 
                    Once assigned, you can view the shorts assigned to you in the <strong>"Editing"</strong> column on the Dashboard.
                  </p>
                  <p className="text-neutral-700">
                    If an edited video needs revisions, it will appear in the <strong>"Editing Changes"</strong> column for you to review and update.
                  </p>
                </div>

                <div>
                  <h3 className="font-semibold text-neutral-900 mb-2">Your Workflow</h3>
                  <ol className="list-decimal list-inside space-y-2 text-neutral-700">
                    <li>Click on a short card in the "Editing" column to view details</li>
                    <li>Download the Clips ZIP from the short detail page</li>
                    <li>Edit the clips together according to the script</li>
                    <li>Upload your final edited video using the "Upload Final Video" button</li>
                    <li>Once uploaded, mark editing as complete to create payments</li>
                  </ol>
                </div>

                <div>
                  <h3 className="font-semibold text-neutral-900 mb-2">Payment Tracking</h3>
                  <p className="text-neutral-700">
                    When you mark editing as complete, the payment will be automatically tracked in the <strong>Payments</strong> view. 
                    You can check the Payments section at any time to see what you're owed and your payment history.
                  </p>
                </div>
              </div>
            </section>
          )}


          {/* General Tips */}
          <section className="bg-white rounded-xl border border-neutral-200 shadow-sm p-6">
            <h2 className="text-2xl font-semibold text-neutral-900 mb-4">General Tips</h2>
            <div className="space-y-3 text-neutral-700">
              <div className="flex items-start gap-2">
                <span className="text-blue-600 font-bold">•</span>
                <p>Use the Dashboard filters to focus on your assigned work</p>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-blue-600 font-bold">•</span>
                <p>Check the Payments section regularly to track your earnings</p>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-blue-600 font-bold">•</span>
                <p>Make sure to complete your profile with PayPal email for payments</p>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-blue-600 font-bold">•</span>
                <p>Contact an admin if you have questions about assignments or payments</p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

