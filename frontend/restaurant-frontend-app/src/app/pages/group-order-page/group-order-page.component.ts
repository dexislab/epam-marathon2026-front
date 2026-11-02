import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { forkJoin } from 'rxjs';
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

@Component({
  selector: 'app-group-order-page',
  imports: [ParticipantCardComponent, ModalComponent, CurrencyPipe, DatePipe],
  templateUrl: './group-order-page.component.html',
  styleUrl: './group-order-page.component.scss',
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class GroupOrderPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly groupOrdersService = inject(GroupOrdersService);
  private readonly toastService = inject(ToastService);

  private readonly reservationId = this.route.snapshot.paramMap.get('reservationId') ?? '';

  // ── Page-level state ───────────────────────────────────────────────────────
  readonly pageState = signal<PageState>('loading');

  // ── Data signals ───────────────────────────────────────────────────────────
  readonly invite = signal<GuestInvite | null>(null);
  readonly participants = signal<Participant[]>([]);
  readonly ownerSessionId = signal<string>('');
  readonly groupStatus = signal<GroupReservationStatus>('Open');

  private groupReservationId = '';

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

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.pageState.set('loading');

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
        this.pageState.set('ready');
      },
      error: () => {
        this.pageState.set('error');
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
}
