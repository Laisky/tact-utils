contract HelloWorld {
    owner: Address;

    init(owner: Address) {
        self.owner = owner;
    }

    receive("hello") {
        let resp: String = "";
        if (self.owner != sender()) {
            resp = "hello world"
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
}
