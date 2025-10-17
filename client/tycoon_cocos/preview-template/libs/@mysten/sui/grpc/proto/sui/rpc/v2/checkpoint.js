import { MessageType } from "@protobuf-ts/runtime";
import { ObjectSet } from "./object";
import { ExecutedTransaction } from "./executed_transaction";
import { CheckpointContents } from "./checkpoint_contents";
import { ValidatorAggregatedSignature } from "./signature";
import { CheckpointSummary } from "./checkpoint_summary";
class Checkpoint$Type extends MessageType {
  constructor() {
    super("sui.rpc.v2.Checkpoint", [
      {
        no: 1,
        name: "sequence_number",
        kind: "scalar",
        opt: true,
        T: 4,
        L: 0
        /*LongType.BIGINT*/
      },
      {
        no: 2,
        name: "digest",
        kind: "scalar",
        opt: true,
        T: 9
        /*ScalarType.STRING*/
      },
      { no: 3, name: "summary", kind: "message", T: () => CheckpointSummary },
      { no: 4, name: "signature", kind: "message", T: () => ValidatorAggregatedSignature },
      { no: 5, name: "contents", kind: "message", T: () => CheckpointContents },
      { no: 6, name: "transactions", kind: "message", repeat: 1, T: () => ExecutedTransaction },
      { no: 7, name: "objects", kind: "message", T: () => ObjectSet }
    ]);
  }
}
const Checkpoint = new Checkpoint$Type();
export {
  Checkpoint
};
//# sourceMappingURL=checkpoint.js.map
