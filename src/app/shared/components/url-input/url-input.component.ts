import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { Button } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { IconField } from 'primeng/iconfield';
import { InputIcon } from 'primeng/inputicon';

@Component({
  selector: 'app-url-input',
  imports: [ReactiveFormsModule, Button, InputText, IconField, InputIcon],
  templateUrl: './url-input.component.html',
  styleUrl: './url-input.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UrlInputComponent {
  readonly loading = input(false);
  readonly initialUrl = input('');
  readonly submitted = output<string>();

  protected readonly urlControl = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.minLength(8)],
  });

  protected submit(event?: Event): void {
    event?.preventDefault();

    if (this.loading()) {
      return;
    }

    this.urlControl.markAsTouched();

    if (this.urlControl.invalid) {
      return;
    }

    this.submitted.emit(this.urlControl.value.trim());
  }

  protected setExampleUrl(): void {
    this.urlControl.setValue('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  }
}
