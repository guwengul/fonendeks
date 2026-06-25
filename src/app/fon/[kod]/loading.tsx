export default function FonDetayLoading() {
  return (
    <div className="max-w-5xl mx-auto w-full px-4 sm:px-6 py-8 animate-pulse">
      <div className="h-4 w-20 bg-slate-200 rounded mb-6" />

      <div className="mb-6">
        <div className="flex items-center gap-3">
          <div className="h-7 w-16 bg-slate-200 rounded" />
          <div className="h-5 w-10 bg-slate-200 rounded" />
          <div className="h-5 w-24 bg-slate-200 rounded" />
        </div>
        <div className="h-4 w-64 bg-slate-200 rounded mt-2" />
        <div className="flex gap-4 mt-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-3 w-20 bg-slate-200 rounded" />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-7 gap-3 mb-8">
        {[...Array(7)].map((_, i) => (
          <div key={i} className="bg-white rounded-xl p-4 border border-slate-200">
            <div className="h-3 w-12 bg-slate-200 rounded mb-2" />
            <div className="h-6 w-16 bg-slate-200 rounded" />
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 h-72" />
    </div>
  )
}
