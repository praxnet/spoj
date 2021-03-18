hostip=`(hostname -i | awk '{print $1}')`
echo "$hostip master" >> /etc/hosts
echo "hosts file updated"
sleep 3
/usr/local/bin/k3s-uninstall.sh
echo "cluster uninstalled"
sleep 3
rm  -rf /var/lib/rancher
rm ~/.kube/config
sleep 3
echo "DNS=8.8.8.8" >> /etc/systemd/resolved.conf
systemctl restart systemd-networkd systemd-resolved
sleep 3
sed -i 's/127.0.0.53/'8.8.8.8'/g' /etc/resolv.conf
echo "updated nameserver"
sleep 3
echo "adding google Linux Package Signing Keys"
wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | sudo apt-key add -
