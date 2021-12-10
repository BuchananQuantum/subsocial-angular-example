import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
} from '@angular/core';
import { TransactionService } from '../../shared/services/transaction.service';
import { AccountService } from '../../shared/services/account.service';
import { skipWhile, take } from 'rxjs/operators';
import { SubmittableResult } from '@polkadot/api';

export type ExtrinsicProps = {
  pallet: string;
  method: string;
  params: string[];
};

@Component({
  template: '',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export abstract class TxButtonComponent {
  extrinsic: any;
  signer: any;
  accountId: string | undefined;
  txUnsub: Function;
  isSending: boolean = false;
  isAuthRequired: boolean = true;
  isFreeTx: boolean = false;

  abstract onSuccess(result: SubmittableResult): void;
  abstract onFailed(result: SubmittableResult | null): void;
  abstract validate(): boolean;

  protected constructor(
    public transactionService: TransactionService,
    public accountService: AccountService,
    public cd: ChangeDetectorRef
  ) {}

  protected async initExtrinsic(props: ExtrinsicProps) {
    this.accountService.signer$
      .pipe(
        skipWhile((sinner) => sinner === null),
        take(1)
      )
      .subscribe((sinner) => (this.signer = sinner));

    this.accountService.currentAccount$
      .pipe(skipWhile((account) => account === null))
      .subscribe((account) => (this.accountId = account?.id));

    this.extrinsic = await this.transactionService.getExtrinsic(props);
  }

  doOnSuccess(result: SubmittableResult) {
    this.onSuccess(result);
    //this.transactionService.showSuccessMessage('test');
  }

  doOnFailed(result: SubmittableResult | null) {
    console.error(result);
    this.onFailed(result);
    this.setIsSending(false);
  }

  async sentTransaction() {
    this.unsubscribe();

    if (!this.validate()) {
      console.warn('Cannot send a tx because validate() returned false');
      return;
    }

    const txType = this.accountId ? 'signed' : 'unsigned';
    console.debug(`Sending ${txType} tx...`);

    this.setIsSending(true);

    if (txType === 'unsigned') {
      if (this.isAuthRequired && !this.isFreeTx) {
        await this.accountService.openSignInModal();
        return this.setIsSending(false);
      }
      await this.sendUnsignedTx();
    } else {
      await this.sendSignedTx();
    }
  }

  async onSuccessHandler(result: SubmittableResult) {
    if (!result || !result.status) {
      return;
    }

    const { status } = result;
    if (status.isFinalized || status.isInBlock) {
      this.setIsSending(false);
      this.unsubscribe();

      const blockHash = status.isFinalized
        ? status.asFinalized
        : status.asInBlock;

      console.warn(`✅ Tx finalized. Block hash: ${blockHash.toString()}`);

      result.events
        .filter(({ event: { section } }): boolean => section === 'system')
        .forEach(({ event: { method } }): void => {
          if (method === 'ExtrinsicSuccess') {
            this.doOnSuccess(result);
          } else if (method === 'ExtrinsicFailed') {
            this.doOnFailed(result);
          }
        });
    } else if (result.isError) {
      this.doOnFailed(result);
    } else {
      console.warn(`⏱ Current tx status: ${status.type}`);
    }
  }

  onFailedHandler(err: Error) {
    if (err) {
      const errMsg = `Tx failed: ${err.toString()}`;
      console.warn(`❌ ${errMsg}`);
      this.transactionService.showErrorMessage(errMsg);
    }

    this.doOnFailed(null);
  }

  async sendSignedTx() {
    if (!this.accountId) {
      throw new Error('No account id provided');
    }

    if (!this.signer) {
      throw new Error('No signer provided');
    }

    try {
      const tx = await this.extrinsic.signAsync(this.accountId, {
        signer: this.signer,
      });
      this.txUnsub = await tx.send(this.onSuccessHandler.bind(this));
      this.transactionService.showWaitMessage();
    } catch (err: any) {
      this.onFailedHandler(err);
      console.error(err);
    }
  }

  async sendUnsignedTx() {
    try {
      this.txUnsub = await this.extrinsic.send(
        this.onSuccessHandler.bind(this)
      );
      this.transactionService.showWaitMessage();
    } catch (err: any) {
      this.onFailedHandler(err);
    }
  }

  setIsSending(value: boolean) {
    this.isSending = value;
    this.cd.markForCheck();
  }

  setIsAuthRequired(value: boolean) {
    this.isAuthRequired = value;
  }

  setIsFreeTx(value: boolean) {
    this.isFreeTx = value;
  }

  unsubscribe() {
    if (this.txUnsub) {
      this.transactionService.closeWaitMessage();
      this.txUnsub();
    }
  }
}
