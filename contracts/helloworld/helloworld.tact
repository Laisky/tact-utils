import "../common/traits.tact";
import "../common/messages.tact";

contract HelloWorld with Upgradable {
    owner: Address;

    init(owner: Address) {
        self.owner = owner;
    }

    receive("hello") {
        let resp: String = "";
        if (self.owner != sender()) {
            resp = "hello, world"
        }else {
            resp = "hello, owner"
        }

        send(SendParameters{
            to: sender(),
            value: 0,
            mode: SendRemainingValue,
            bounce: false,
            body: resp.asComment(),
        });
    }

    get fun version(): String {
        return "v1";
    }
}


contract HelloWorldV2 with Upgradable {
    owner: Address;

    init(owner: Address) {
        self.owner = owner;
    }

    receive("hello") {
        let resp: String = "";
        if (self.owner != sender()) {
            resp = "hello-v2 world"
        }else {
            resp = "hello-v2, owner"
        }

        send(SendParameters{
            to: sender(),
            value: 0,
            mode: SendRemainingValue,
            bounce: false,
            body: resp.asComment(),
        });
    }

    get fun version(): String {
        return "v2";
    }
}
