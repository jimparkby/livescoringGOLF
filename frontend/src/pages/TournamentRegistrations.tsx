import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Users, Clock, CheckCircle, AlertCircle, LayoutGrid, Link as LinkIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { api } from '@/lib/api'
import { TOURNAMENTS } from '@/lib/tournaments'
import { COURSES } from '@/lib/courses'
import { toast } from 'sonner'

type Registration = {
  id: number
  tournament_id: string
  user_id: string
  status: 'pending_review' | 'awaiting_payment' | 'paid'
  created_at: string
  updated_at: string
  first_name: string
  last_name: string
  hcp: number
  photo_url?: string
  round_id: string | null
  flight_label: string | null
  checked_in: boolean
  access_token: string | null
}

const STATUS_LABELS = {
  pending_review: 'На рассмотрении',
  awaiting_payment: 'Ждет оплаты',
  paid: 'Оплачено'
}

const STATUS_ICONS = {
  pending_review: AlertCircle,
  awaiting_payment: Clock,
  paid: CheckCircle
}

const STATUS_COLORS = {
  pending_review: 'bg-yellow-500/20 text-yellow-700 border-yellow-500/30',
  awaiting_payment: 'bg-orange-500/20 text-orange-700 border-orange-500/30',
  paid: 'bg-green-500/20 text-green-700 border-green-500/30'
}

export default function TournamentRegistrationsPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [registrations, setRegistrations] = useState<Registration[]>([])
  const [loading, setLoading] = useState(true)
  const [updatingId, setUpdatingId] = useState<number | null>(null)
  const [buildingGroups, setBuildingGroups] = useState(false)

  const tournament = TOURNAMENTS.find(t => t.id === id)

  useEffect(() => {
    loadRegistrations()
  }, [id])

  const loadRegistrations = async () => {
    if (!id) return

    setLoading(true)
    try {
      const data = await api.get<Registration[]>(`/api/tournament-registrations/${id}`)
      setRegistrations(data)
    } catch (error) {
      console.error('[TournamentRegistrations] Error loading registrations:', error)
      toast.error('Ошибка загрузки регистраций')
    } finally {
      setLoading(false)
    }
  }

  const updateStatus = async (registrationId: number, newStatus: 'pending_review' | 'awaiting_payment' | 'paid') => {
    setUpdatingId(registrationId)
    try {
      await api.patch(`/api/tournament-registrations/${registrationId}/status`, { status: newStatus })
      setRegistrations(prev =>
        prev.map(r => r.id === registrationId ? { ...r, status: newStatus, updated_at: new Date().toISOString() } : r)
      )
      toast.success('Статус обновлен')
    } catch (error) {
      console.error('[TournamentRegistrations] Error updating status:', error)
      toast.error('Ошибка при обновлении статуса')
    } finally {
      setUpdatingId(null)
    }
  }

  const paidUngrouped = registrations.filter(r => r.status === 'paid' && !r.round_id).length

  const buildGroups = async () => {
    if (!id || !tournament) return
    const course = COURSES.find(c => c.id === tournament.courseId) ?? COURSES[0]
    const tee = course.tees.find(t => t.color === 'yellow') ?? course.tees[0]
    setBuildingGroups(true)
    try {
      const res = await api.post<{ groupsCreated: number; playersGrouped: number }>(
        `/api/tournaments/${id}/build-groups`,
        {
          courseId: course.id,
          courseName: `${tournament.name} · ${course.name}`,
          tee: tee.color,
          rating: tee.rating,
          slope: tee.slope,
          format: tournament.format,
          holesMode: '18',
          groupSize: 4,
        }
      )
      toast.success(`Сформировано групп: ${res.groupsCreated} (${res.playersGrouped} игроков)`)
      loadRegistrations()
    } catch (error) {
      console.error('[TournamentRegistrations] Error building groups:', error)
      toast.error('Ошибка при формировании групп')
    } finally {
      setBuildingGroups(false)
    }
  }

  if (!tournament) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl mb-3">🏌️</div>
          <div className="text-lg font-semibold">Турнир не найден</div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(`/tournament-info/${id}`)}
          className="h-10 w-10 rounded-full bg-muted/50 hover:bg-muted flex items-center justify-center transition-colors shrink-0"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="text-xs uppercase tracking-[0.25em] text-muted-foreground font-semibold">
            Регистрации
          </div>
          <h1 className="text-xl sm:text-2xl font-bold mt-0.5 leading-tight">{tournament.name}</h1>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="p-4 text-center">
          <div className="text-2xl font-bold">{registrations.length}</div>
          <div className="text-xs text-muted-foreground mt-1">Всего</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-2xl font-bold text-yellow-600">
            {registrations.filter(r => r.status === 'pending_review').length}
          </div>
          <div className="text-xs text-muted-foreground mt-1">На рассмотрении</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-2xl font-bold text-green-600">
            {registrations.filter(r => r.status === 'paid').length}
          </div>
          <div className="text-xs text-muted-foreground mt-1">Оплачено</div>
        </Card>
      </div>

      {/* Build groups */}
      {paidUngrouped > 0 && (
        <Button
          onClick={buildGroups}
          disabled={buildingGroups}
          className="w-full h-12 rounded-xl font-bold text-sm bg-action hover:bg-action/90 text-action-foreground"
        >
          <LayoutGrid className="h-4 w-4 mr-2" strokeWidth={2.5} />
          {buildingGroups ? 'Формирование...' : `Сформировать флайты и группы (${paidUngrouped})`}
        </Button>
      )}

      {/* Registrations List */}
      {loading ? (
        <Card className="p-8 text-center text-muted-foreground">
          Загрузка...
        </Card>
      ) : registrations.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">
          <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <div>Нет регистраций</div>
        </Card>
      ) : (
        <div className="space-y-3">
          {registrations.map(reg => {
            const StatusIcon = STATUS_ICONS[reg.status]
            return (
              <Card key={reg.id} className="p-4">
                <div className="flex items-start gap-3">
                  {/* Photo */}
                  {reg.photo_url ? (
                    <img
                      src={reg.photo_url}
                      alt={`${reg.first_name} ${reg.last_name}`}
                      className="h-12 w-12 rounded-full object-cover shrink-0"
                    />
                  ) : (
                    <div className="h-12 w-12 rounded-full bg-muted grid place-items-center text-lg font-bold shrink-0">
                      {reg.first_name[0]}{reg.last_name[0]}
                    </div>
                  )}

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm">
                      {reg.first_name} {reg.last_name}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      HCP {reg.hcp.toFixed(1)} • {new Date(reg.created_at).toLocaleDateString('ru-RU')}
                    </div>
                    {reg.round_id && (
                      <div className="flex items-center gap-2 mt-0.5">
                        <div className="text-xs text-action font-medium">
                          {reg.flight_label} {reg.checked_in ? '· на поле' : '· ждём старта'}
                        </div>
                        {reg.access_token && (
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(`${window.location.origin}/tlive/${reg.access_token}`)
                              toast.success('Ссылка скопирована')
                            }}
                            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-action transition-colors"
                          >
                            <LinkIcon className="h-3 w-3" /> Ссылка на live-скоринг
                          </button>
                        )}
                      </div>
                    )}

                    {/* Status Select */}
                    <div className="mt-3 flex items-center gap-2">
                      <select
                        value={reg.status}
                        onChange={(e) => updateStatus(reg.id, e.target.value as any)}
                        disabled={updatingId === reg.id}
                        className={cn(
                          "px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer",
                          STATUS_COLORS[reg.status],
                          updatingId === reg.id && "opacity-50 cursor-not-allowed"
                        )}
                      >
                        <option value="pending_review">На рассмотрении</option>
                        <option value="awaiting_payment">Ждет оплаты</option>
                        <option value="paid">Оплачено</option>
                      </select>

                      <StatusIcon className={cn(
                        "h-4 w-4",
                        reg.status === 'pending_review' && "text-yellow-600",
                        reg.status === 'awaiting_payment' && "text-orange-600",
                        reg.status === 'paid' && "text-green-600"
                      )} />
                    </div>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
