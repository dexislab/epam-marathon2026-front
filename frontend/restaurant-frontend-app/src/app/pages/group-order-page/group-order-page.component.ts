import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnDestroy,
  OnInit,
  signal,
} from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { forkJoin, interval, of, Subscription } from 'rxjs';
import { catchError, exhaustMap, takeWhile } from 'rxjs/operators';
import { HttpErrorResponse } from '@angular/common/http';
import { GroupOrdersService } from '@app/services/group-orders/group-orders.service';
import { ToastService } from '@app/services/toast/toast.service';
import { ParticipantCardComponent } from '@app/components/group-orders/participant-card/participant-card.component';
import { ModalComponent } from '@app/shared/custom-components/modal/modal.component';
import { consolidatePreOrder } from '@app/shared/helpers/consolidate-pre-order';
import { GuestInvite } from '@app/models/reservations/guest-invite.model';
import { Participant } from '@app/models/group-orders/participant.model';
import { GroupReservationStatus } from '@app/models/group-orders/group-status.model';

type PageState = 'loading' | 'error-404' | 'error' | 'ready';

const POLL_INTERVAL_MS = 15_000;

@Component({
  selector: 'app-group-order-page',
  imports: [ParticipantCardComponent, ModalComponent, CurrencyPipe, DatePipe],
  templateUrl: './group-order-page.component.html',
  styleUrl: './group-order-page.component.scss',
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class GroupOrderPageComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly groupOrdersService = inject(GroupOrdersService);
  private readonly toastService = inject(ToastService);

  readonly reservationId = this.route.snapshot.paramMap.get('reservationId') ?? '';

  // ── Page-level state ───────────────────────────────────────────────────────
  readonly pageState = signal<PageState>('loading');

  // ── Data signals ───────────────────────────────────────────────────────────
  readonly invite = signal<GuestInvite | null>(null);
  readonly participants = signal<Participant[]>([]);
  readonly ownerSessionId = signal<string>('');
  readonly groupStatus = signal<GroupReservationStatus>('Open');

  // ── Sync state ─────────────────────────────────────────────────────────────
  readonly updatedAt = signal<Date | null>(null);
  readonly refreshError = signal(false);

  private groupReservationId = '';
  private pollSub: Subscription | null = null;

  // ── Derived (computed) values ──────────────────────────────────────────────
  readonly consolidatedOrder = computed(() => consolidatePreOrder(this.participants()));
  readonly grandTotal = computed(() => this.consolidatedOrder().total);
  readonly consolidatedItems = computed(() => this.consolidatedOrder().items);

  readonly pendingCount = computed(
    () => this.participants().filter((p) => !p.isSubmitted).length,
  );

  readonly hasAnyDishes = computed(() =>
    this.participants().some((p) => p.items.length > 0),
  );

  readonly hasSubmittedParticipants = computed(() =>
    this.participants().some((p) => p.isSubmitted),
  );

  readonly statusLabel = computed(() => {
    const status = this.groupStatus();
    if (status === 'Submitted') return 'Sent to Restaurant';
    if (status === 'Closed') return 'Closed';
    return 'Collecting pre-orders';
  });

  readonly isSubmitted = computed(() => this.groupStatus() === 'Submitted');

  // ── Submit-dialog state ────────────────────────────────────────────────────
  readonly showSubmitModal = signal(false);
  readonly submitting = signal(false);

  // ── Remove-dialog state ────────────────────────────────────────────────────
  readonly participantToRemove = signal<Participant | null>(null);

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  ngOnInit(): void {
    this.load();
  }

  ngOnDestroy(): void {
    this.stopPolling();
  }

  // ── Initial load ───────────────────────────────────────────────────────────
  load(): void {
    this.pageState.set('loading');
    this.stopPolling();

    this.groupOrdersService.getGroupInvite$(this.reservationId).subscribe({
      next: (inv) => {
        this.invite.set(inv);
        this.groupReservationId = inv.GroupReservationId;
        this.loadGroupData();
      },
      error: (err: HttpErrorResponse) => {
        this.pageState.set(err.status === 404 ? 'error-404' : 'error');
      },
    });
  }

  private loadGroupData(): void {
    forkJoin({
      sessions: this.groupOrdersService.getSessions$(this.groupReservationId),
      ownerSessionId: this.groupOrdersService.getOwnerSessionId$(this.reservationId),
      status: this.groupOrdersService.getStatus$(this.groupReservationId),
    }).subscribe({
      next: ({ sessions, ownerSessionId, status }) => {
        this.participants.set(sessions.participants);
        this.ownerSessionId.set(ownerSessionId);
        this.groupStatus.set(status.status);
        this.updatedAt.set(new Date());
        this.refreshError.set(false);
        this.pageState.set('ready');
        this.startPolling();
      },
      error: () => {
        this.pageState.set('error');
      },
    });
  }

  // ── Background polling ─────────────────────────────────────────────────────
  private startPolling(): void {
    this.stopPolling();

    this.pollSub = interval(POLL_INTERVAL_MS)
      .pipe(
        takeWhile(() => this.groupStatus() === 'Open'),
        exhaustMap(() =>
          this.groupOrdersService.getSessions$(this.groupReservationId, { silent: true }).pipe(
            catchError(() => {
              this.refreshError.set(true);
              // return EMPTY-like: null signals an error tick, handled below
              return of(null);
            }),
          ),
        ),
      )
      .subscribe((sessions) => {
        if (sessions !== null) {
          this.participants.set(sessions.participants);
          this.updatedAt.set(new Date());
          this.refreshError.set(false);
        }
      });
  }

  private stopPolling(): void {
    this.pollSub?.unsubscribe();
    this.pollSub = null;
  }

  refresh(): void {
    this.groupOrdersService.getSessions$(this.groupReservationId, { silent: true }).subscribe({
      next: (sessions) => {
        this.participants.set(sessions.participants);
        this.updatedAt.set(new Date());
        this.refreshError.set(false);
      },
      error: () => {
        this.refreshError.set(true);
      },
    });
  }

  // ── Submit flow ────────────────────────────────────────────────────────────
  openSubmitModal(): void {
    this.showSubmitModal.set(true);
  }

  closeSubmitModal(): void {
    this.showSubmitModal.set(false);
  }

  confirmSubmit(): void {
    if (this.submitting()) return;
    this.submitting.set(true);

    this.groupOrdersService.submit$(this.groupReservationId, this.reservationId).subscribe({
      next: () => {
        this.groupStatus.set('Submitted');
        this.stopPolling();
        this.showSubmitModal.set(false);
        this.submitting.set(false);
        this.toastService.success('Pre-order sent to the restaurant');
      },
      error: () => {
        this.submitting.set(false);
        this.showSubmitModal.set(false);
      },
    });
  }

  // ── Remove Guest flow ──────────────────────────────────────────────────────
  openRemoveModal(participant: Participant): void {
    this.participantToRemove.set(participant);
  }

  closeRemoveModal(): void {
    this.participantToRemove.set(null);
  }

  confirmRemove(): void {
    const participant = this.participantToRemove();
    if (!participant) return;

    this.groupOrdersService
      .removeSession$(this.groupReservationId, participant.id)
      .subscribe({
        next: (sessions) => {
          this.participants.set(sessions.participants);
          this.participantToRemove.set(null);
        },
        error: () => {
          this.participantToRemove.set(null);
        },
      });
  }
}
