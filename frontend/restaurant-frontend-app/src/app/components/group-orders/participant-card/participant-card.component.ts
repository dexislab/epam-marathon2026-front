import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { Participant } from '@app/models/group-orders/participant.model';
import { CurrencyPipe } from '@angular/common';

@Component({
  selector: 'app-participant-card',
  templateUrl: './participant-card.component.html',
  styleUrl: './participant-card.component.scss',
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [CurrencyPipe],
})
export class ParticipantCardComponent {
  readonly participant = input.required<Participant>();
  /** When true the card belongs to the current owner — title shows "My Pre-Order". */
  readonly isMe = input(false);
  /** Show "Remove Guest" button — only for Guest-type cards, only before submit. */
  readonly canRemove = input(false);

  readonly removeClick = output<Participant>();

  readonly title = computed(() => {
    if (this.isMe()) return 'My Pre-Order';
    const person = this.participant();
    return person.type === 'Owner' ? `Owner: ${person.name}` : `Guest: ${person.name}`;
  });

  onRemoveClick(): void {
    this.removeClick.emit(this.participant());
  }
}
