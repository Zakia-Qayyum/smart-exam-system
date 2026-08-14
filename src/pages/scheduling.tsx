import { useSearchParams } from 'react-router-dom'
import { Tabs } from '@/components/ui/tabs'
import { BulkGenerate } from '@/components/scheduling/bulk-generate'
import { ManualEntry } from '@/components/scheduling/manual-entry'

export function SchedulingPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const requested = searchParams.get('tab')
  const value = requested === 'manual' ? 'manual' : 'bulk'

  const handleTabChange = (next: string) => {
    const params = new URLSearchParams(searchParams)
    if (next === 'bulk') params.delete('tab')
    else params.set('tab', next)
    setSearchParams(params, { replace: true })
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div>
        <h1 className="text-2xl font-black tracking-tight text-ink">Scheduling Engine</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Generate a draft timetable in bulk or add individual entries with live clash checks —
          powered by the real scheduling and clash APIs.
        </p>
      </div>

      <div className="mt-6">
        <Tabs
          value={value}
          onChange={handleTabChange}
          tabs={[
            {
              value: 'bulk',
              label: 'Bulk Generate',
              content: <BulkGenerate />,
            },
            {
              value: 'manual',
              label: 'Manual Entry / Edit',
              content: <ManualEntry />,
            },
          ]}
        />
      </div>
    </div>
  )
}
