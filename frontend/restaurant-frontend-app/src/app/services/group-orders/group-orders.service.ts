import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, switchMap } from 'rxjs';
import { map } from 'rxjs/operators';
import { API_BASE_URL } from '@app/shared/config/api-base-url.token';
import { GuestInvite, GroupInviteToken } from '@app/models/reservations/guest-invite.model';
import { GroupSessionsResponse } from '@app/models/group-orders/group-sessions-response.model';
import { GroupStatusResponse } from '@app/models/group-orders/group-status.model';
import { OwnerSessionResponse } from '@app/models/group-orders/owner-session.model';
import { SubmittedDish } from '@app/models/group-orders/submit-group-pre-order.model';

@Injectable({ providedIn: 'root' })
export class GroupOrdersService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /** GET /reservations/{id}/invite-token → GET /guest/invites/{token} */
  getGroupInvite$(reservationId: string): Observable<GuestInvite> {
    return this.http
      .get<GroupInviteToken>(`${this.baseUrl}/reservations/${reservationId}/invite-token`)
      .pipe(
        switchMap((res) => this.http.get<GuestInvite>(`${this.baseUrl}/guest/invites/${res.token}`)),
      );
  }

  /** GET /guest/groups/{groupReservationId}/sessions */
  getSessions$(groupReservationId: string): Observable<GroupSessionsResponse> {
    return this.http.get<GroupSessionsResponse>(
      `${this.baseUrl}/guest/groups/${groupReservationId}/sessions`,
    );
  }

  /** GET /reservations/{reservationId}/guest-session-id → string */
  getOwnerSessionId$(reservationId: string): Observable<string> {
    return this.http
      .get<OwnerSessionResponse>(`${this.baseUrl}/reservations/${reservationId}/guest-session-id`)
      .pipe(map((res) => res.guestSessionId));
  }

  /** GET /guest/groups/{groupReservationId}/status */
  getStatus$(groupReservationId: string): Observable<GroupStatusResponse> {
    return this.http.get<GroupStatusResponse>(
      `${this.baseUrl}/guest/groups/${groupReservationId}/status`,
    );
  }

  /** POST /group-reservations/{groupReservationId}/submit */
  submit$(groupReservationId: string, reservationId: string): Observable<SubmittedDish[]> {
    return this.http.post<SubmittedDish[]>(
      `${this.baseUrl}/group-reservations/${groupReservationId}/submit`,
      { reservationId },
    );
  }
}
