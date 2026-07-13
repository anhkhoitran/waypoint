import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Button, Card } from '@waypoint/ui';
import type { ApplicationBoard, ApplicationStage } from '@waypoint/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  useApplicationsBoard,
  useApplicationsStats,
  useCreateApplication,
  useUpdateApplicationStage,
} from '../api/applications';
import { ApplicationCard } from '../components/ApplicationCard';
import { ApplicationDrawer } from '../components/ApplicationDrawer';
import { Icon } from '../components/Icon';
import { PageHeader } from '../components/PageHeader';
import { ACTIVE_STAGES, CLOSED_STAGES } from '../lib/applicationDisplay';
import { kanbanKeyboardCoordinates } from '../lib/kanbanKeyboardCoordinates';
import { usePageTitle } from '../lib/usePageTitle';
import { useToast } from '../toast';

const ALL_STAGES: ApplicationStage[] = [...ACTIVE_STAGES, ...CLOSED_STAGES];

function findStageOf(id: string, board: ApplicationBoard): ApplicationStage | undefined {
  return ALL_STAGES.find((stage) => board[stage].some((a) => a.id === id));
}

function KanbanColumn({
  stage,
  applicationIds,
  children,
  variant = 'default',
}: {
  stage: ApplicationStage;
  applicationIds: string[];
  children: React.ReactNode;
  variant?: 'default' | 'closed';
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  return (
    <div
      ref={setNodeRef}
      className={`kanban-column${variant === 'closed' ? ' kanban-column-closed' : ''}${isOver ? ' kanban-column-over' : ''}`}
    >
      <SortableContext items={applicationIds} strategy={verticalListSortingStrategy}>
        {children}
      </SortableContext>
    </div>
  );
}

export function TrackerPage() {
  const { t } = useTranslation();
  usePageTitle(t('nav.applications'));
  const { showToast } = useToast();
  const boardQuery = useApplicationsBoard();
  const statsQuery = useApplicationsStats();
  const updateStage = useUpdateApplicationStage();
  const createApplication = useCreateApplication();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [manualCompany, setManualCompany] = useState('');
  const [manualTitle, setManualTitle] = useState('');
  const [manualUrl, setManualUrl] = useState('');

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: kanbanKeyboardCoordinates }),
  );

  const board = boardQuery.data;
  const totalCount = board ? ALL_STAGES.reduce((n, s) => n + board[s].length, 0) : 0;

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || !board) return;
    const activeId = String(active.id);
    const overId = String(over.id);
    const fromStage = findStageOf(activeId, board);
    const toStage: ApplicationStage | undefined = (ALL_STAGES as string[]).includes(overId)
      ? (overId as ApplicationStage)
      : findStageOf(overId, board);
    if (!fromStage || !toStage || fromStage === toStage) return;
    updateStage.mutate(
      { id: activeId, stage: toStage },
      {
        onSuccess: () => showToast(t('tracker.toastMoved', { stage: t(`tracker.stage.${toStage}`) })),
        onError: () => showToast(t('tracker.toastMoveError'), 'error'),
      },
    );
  };

  const handleAddManual = () => {
    if (!manualCompany.trim() || !manualTitle.trim() || !manualUrl.trim()) return;
    createApplication.mutate(
      { company: manualCompany.trim(), title: manualTitle.trim(), url: manualUrl.trim() },
      {
        onSuccess: () => {
          setManualCompany('');
          setManualTitle('');
          setManualUrl('');
          setShowAddForm(false);
        },
      },
    );
  };

  return (
    <>
      <PageHeader
        title={t('tracker.title')}
        subtitle={t('tracker.subtitle')}
        actions={
          <Button onClick={() => setShowAddForm((v) => !v)}>
            <Icon name="plus" size={14} />
            {t('tracker.addManual')}
          </Button>
        }
      />

      {showAddForm ? (
        <Card style={{ marginBottom: 16 }}>
          <div className="application-add-form">
            <input
              className="profile-text-input"
              placeholder={t('tracker.addManualCompany')}
              value={manualCompany}
              onChange={(e) => setManualCompany(e.target.value)}
            />
            <input
              className="profile-text-input"
              placeholder={t('tracker.addManualTitle')}
              value={manualTitle}
              onChange={(e) => setManualTitle(e.target.value)}
            />
            <input
              className="profile-text-input"
              placeholder={t('tracker.addManualUrl')}
              value={manualUrl}
              onChange={(e) => setManualUrl(e.target.value)}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <Button onClick={handleAddManual} disabled={createApplication.isPending}>
                {t('tracker.addManualSubmit')}
              </Button>
              <Button variant="ghost" onClick={() => setShowAddForm(false)}>
                {t('tracker.addManualCancel')}
              </Button>
            </div>
          </div>
        </Card>
      ) : null}

      {statsQuery.data ? (
        <div className="review-stats-strip">
          <div className="review-stat">
            <span className="review-stat-value">
              {statsQuery.data.responseRate !== null ? `${Math.round(statsQuery.data.responseRate * 100)}%` : '—'}
            </span>
            <span className="review-stat-label">{t('tracker.statResponseRate')}</span>
          </div>
          <div className="review-stat">
            <span className="review-stat-value">{statsQuery.data.interviewsThisWeek}</span>
            <span className="review-stat-label">{t('tracker.statInterviewsThisWeek')}</span>
          </div>
          <div className="review-stat">
            <span className="review-stat-value">
              {statsQuery.data.avgDaysInStage !== null ? Math.round(statsQuery.data.avgDaysInStage) : '—'}
            </span>
            <span className="review-stat-label">{t('tracker.statAvgDaysInStage')}</span>
          </div>
        </div>
      ) : null}

      {boardQuery.isLoading ? (
        <div className="skeleton-card" />
      ) : boardQuery.isError ? (
        <div className="error-state">
          <Icon name="alert" size={16} />
          {t('common.loadError', { thing: t('tracker.title') })}
        </div>
      ) : totalCount === 0 ? (
        <div className="empty-state">
          <span className="empty-icon">
            <Icon name="kanban" size={24} />
          </span>
          <h2 className="empty-title">{t('tracker.emptyBoard')}</h2>
          <p className="empty-blurb">{t('tracker.emptyBoardBlurb')}</p>
        </div>
      ) : board ? (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <div className="kanban-board">
            <div className="kanban-columns">
              {ACTIVE_STAGES.map((stage) => (
                <div key={stage} className="kanban-column-wrap">
                  <div className="kanban-column-header">
                    <span>{t(`tracker.stage.${stage}`)}</span>
                    <span className="kanban-column-count">{board[stage].length}</span>
                  </div>
                  <KanbanColumn stage={stage} applicationIds={board[stage].map((a) => a.id)}>
                    {board[stage].map((application) => (
                      <ApplicationCard
                        key={application.id}
                        application={application}
                        onClick={() => setSelectedId(application.id)}
                      />
                    ))}
                  </KanbanColumn>
                </div>
              ))}
            </div>

            <div className="kanban-closed-rail-wrap">
              <div className="kanban-column-header kanban-closed-header">{t('tracker.closedRailTitle')}</div>
              {CLOSED_STAGES.map((stage) => (
                <div key={stage} className="kanban-column-wrap">
                  <div className="kanban-column-header kanban-closed-subheader">
                    <span>{t(`tracker.stage.${stage}`)}</span>
                    <span className="kanban-column-count">{board[stage].length}</span>
                  </div>
                  <KanbanColumn stage={stage} applicationIds={board[stage].map((a) => a.id)} variant="closed">
                    {board[stage].map((application) => (
                      <ApplicationCard
                        key={application.id}
                        application={application}
                        onClick={() => setSelectedId(application.id)}
                      />
                    ))}
                  </KanbanColumn>
                </div>
              ))}
            </div>
          </div>
        </DndContext>
      ) : null}

      <ApplicationDrawer applicationId={selectedId} onClose={() => setSelectedId(null)} />
    </>
  );
}
