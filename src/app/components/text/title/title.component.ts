import {
  ChangeDetectionStrategy,
  Component,
  Input,
  OnInit,
} from '@angular/core';
import { TitleSizeType } from '../../../core/types/title.type';

@Component({
  selector: 'app-title',
  templateUrl: './title.component.html',
  styleUrls: ['./title.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TitleComponent implements OnInit {
  @Input() text: string | undefined;
  @Input() type: TitleSizeType = 'medium';
  @Input() link: string = '';
  @Input() isEllipsis: boolean;

  constructor() {}

  classObj = {};

  ngOnInit(): void {
    this.classObj = {
      'title-small': this.type === 'small',
      'title-medium': this.type === 'medium',
      'title-large': this.type === 'large',
      'title-overflow': this.isEllipsis,
    };
  }
}